# Transaction resources

Use `TransactionConfig.resources` to replace or pad the resource declarations
returned by the final Soroban simulation. Omission preserves existing behavior.
These controls do not change what the simulator measures or impose a simulation
execution cap. Classic transaction pipelines reject them.

## Choose overrides or padding

This fragment belongs in a contract invocation's application-supplied config:

```ts
const resources = {
  override: { instructions: 12_000_000 },
  padding: {
    writeBytes: { amount: 10 },
    resourceFee: { percent: 10 },
  },
};
```

| Field           | Unit                       | Override                 | Padding baseline                            |
| --------------- | -------------------------- | ------------------------ | ------------------------------------------- |
| `instructions`  | Whole instruction units    | Final declared budget    | Final simulation instruction recommendation |
| `diskReadBytes` | Whole bytes read from disk | Final declared budget    | Final simulation disk-read recommendation   |
| `writeBytes`    | Whole write bytes          | Final declared budget    | Final simulation write-byte recommendation  |
| `resourceFee`   | Decimal stroop string      | Final total resource fee | Final simulation total resource fee         |

An adjustment accepts exactly one of `{ amount: value }` and
`{ percent: number }`. Amounts are additions, not final totals. `percent: 10`
adds 10%; `percent: 0.5` adds 0.5%. Additions round upward to whole units using
exact arithmetic. Fee amounts use strings; resource counts use safe integers.
Negative values, unknown fields, ambiguous modes and representation overflow
fail locally. A resource cannot appear in both `override` and `padding`.

An override below the simulation recommendation raises `RES_002` before envelope
signing. For example, a 12-million instruction override cannot replace a
13-million recommendation. This is local validation after simulation, not an RPC
simulation failure. The recommendation includes RPC margins and is not a claim
about the precise minimum execution cost.

Padding is applied once, after the final simulation. With delegated
authorization, the intermediate transaction remains unpadded; the enforcing
simulation supplies the final baseline. Auth-entry signing may already have
occurred at that point. The caller's simulation data is cloned.

## Resource fees and byte limits are separate

Increasing the fee does not increase instruction or byte limits. Increasing
those limits does not automatically increase the fee. `resourceFee` includes
non-refundable and refundable components and excludes the inclusion fee.
Additional non-refundable charges can consume existing refundable headroom.

Manual configuration performs no settings reads or automatic repricing. The
network enforces its current ceilings; the calculator below can check explicitly
supplied ceilings in advance. `config.fee.max` still caps the final transaction
fee including adjusted resources, with at least 100 stroops left for inclusion.

## Read settings and calculate padding explicitly

`getNetworkResourceSettings({ rpc })` batches compute, ledger-cost and
ledger-cost-extension entries. It returns scalar limits, instruction/read/write
tariffs, network identity, protocol version and observation ledger. The
ledger-cost extension requires Protocol 23 or later. Missing or invalid settings
raise `RES_006`. Protocol/network identity and settings come from separate RPC
calls and are not an atomic snapshot.

`calculateResourcePadding({ simulation, settings, padding })` is a pure utility.
It performs no RPC calls, mutates no transaction and is never invoked implicitly
by a pipeline. Its request accepts resource adjustments plus `refundableFee`:

```ts
const calculation = calculateResourcePadding({
  simulation,
  settings,
  padding: {
    writeBytes: { amount: 10 },
    refundableFee: { amount: "5000" },
  },
});
```

Here the calculator funds ten extra declared write bytes, preserving the
original refundable allowance, then adds 5,000 stroops of extra refundable
headroom. It returns:

- `padding`: concrete amounts ready for `resources.padding`, including the total
  additional `resourceFee`. Do not add `refundableFee` again.
- `breakdown`: additional non-refundable, refundable and total resource fees.
- `simulationDataXdr`, simulation/settings ledgers, protocol and network
  identity: the inputs needed to identify the quote's baseline.

`refundableFee` is a calculator input, not a separate transaction declaration.
It also supports a percentage, explicitly measured against the simulation's
**total resource fee**: RPC does not expose an isolated refundable
recommendation. For example, `refundableFee: { percent: 10 }` requests extra
refundable headroom equal to 10% of that total, after funding the other resource
increases. The calculator's request does not accept `resourceFee`; its job is to
calculate that amount. Manual transaction configuration accepts `resourceFee`
directly.

The calculation subtracts rounded original resource costs from rounded adjusted
costs. It does not simply round a price for the added bytes. Unchanged
footprint, envelope and event costs cancel. It does not predict future rent, new
footprint keys, authorization changes or additional work caused by ledger-state
changes. Use settings from the same network, and recalculate when transaction
data or tariffs change. Re-running a high-level invocation performs a new
simulation; compare/recalculate instead of assuming an earlier quote still
matches it.

## Assemble using the same simulation

This complete function prepares an application-built transaction for a method
without additional authorization entries. Install `@colibri/core` and Stellar
SDK 17.x. Pass a Testnet/local RPC and unsigned transaction from your
application; network reads require Deno's `--allow-net`. It returns an unsigned
transaction for your existing envelope-signing/submission flow, without
submitting anything. For delegated or non-source authorization, use its final
enforcing simulation and signed auth entries instead; see
[delegated authorization](signer/delegated-signer.md).

<!-- deno-check -->

```ts
import {
  assembleTransaction,
  calculateResourcePadding,
  getNetworkResourceSettings,
  simulateTransaction,
} from "@colibri/core";
import type { Transaction } from "npm:@stellar/stellar-sdk@^17.0.1";
import type { Server } from "npm:@stellar/stellar-sdk@^17.0.1/rpc";

export async function prepareWithPadding(
  transaction: Transaction,
  rpc: Server,
) {
  const simulation = await simulateTransaction({ transaction, rpc });
  if (simulation.result?.auth.length) {
    throw new Error("Resolve authorization and obtain final simulation first.");
  }
  const settings = await getNetworkResourceSettings({ rpc });
  if (settings.networkPassphrase !== transaction.networkPassphrase) {
    throw new Error("RPC and transaction must use the same network.");
  }
  const calculation = calculateResourcePadding({
    simulation,
    settings,
    padding: {
      instructions: { percent: 10 },
      writeBytes: { amount: 10 },
      refundableFee: { amount: "5000" },
    },
  });
  const prepared = await assembleTransaction({
    transaction,
    sorobanData: simulation.transactionData,
    authEntries: [],
    resources: { padding: calculation.padding },
    transactionFee: { max: "1000000" },
  });
  return { transaction: prepared, calculation };
}
```

The same padding shape works in high-level invocation config when calculated
against that invocation's final simulation. Advanced applications can use a
Convee assembly-step plugin to calculate explicitly at that seam; install Convee
directly, since Core does not re-export its factory.

## Diagnose failures

`STX_007` and `STX_010` retain their existing classes, codes, legacy metadata
and raw evidence. `meta.data.failure` adds outer/inner transaction codes,
indexed operation codes, declared resource budgets, available Core execution
counters, and available declared/charged fees. `STX_007` also retains
`resultXDR`.

Counters and fee components are optional. Diagnostic counters may stop at the
failure; they are not a complete successful-retry estimate. An insufficient
refundable-fee code does not establish an exact fee deficit. Unknown or
malformed optional diagnostics do not replace the original failure.
`parseTransactionFailure` is also exported for applications that already have
the envelope and RPC evidence.

See the [resource error reference](../reference/errors/core-resources.md),
[transaction configuration](transaction-config.md),
[API reference](https://jsr.io/@colibri/core/doc), and
[Stellar fee rules](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering).
