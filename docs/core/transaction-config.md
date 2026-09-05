# Transaction Config

`TransactionConfig` is the standard write-transaction configuration used across
Colibri pipelines and high-level clients. The same shape supports classic
transactions, Soroban invocations, and delegated authorization.

```ts
type TransactionConfig = {
  fee: BaseFee | TransactionFee;
  source: TransactionSource;
  timeout: number;
  signers: Signer[];
  extraSigners?: ExtraSignerKey[];
};

type TransactionSource = Ed25519PublicKey | MuxedAddress;

type TransactionFee =
  | { base: BaseFee }
  | { inclusion: InclusionFee }
  | { max: MaxFee };

type BaseFee = `${number}`;
type InclusionFee = `${number}`;
type MaxFee = `${number}`;
```

## Properties

| Property       | Type                        | Description                                              |
| -------------- | --------------------------- | -------------------------------------------------------- |
| `fee`          | `BaseFee \| TransactionFee` | String base fee or one explicit fee strategy             |
| `source`       | `TransactionSource`         | Transaction source as a G-address or M-address           |
| `timeout`      | `number`                    | Transaction timeout in seconds                           |
| `signers`      | `Signer[]`                  | Signers used by the selected transaction flow            |
| `extraSigners` | `ExtraSignerKey[]`          | Exact `G...`, `X...`, or `P...` signer-key preconditions |

### Fee Strategies

`timeout` is forwarded to the builder and preserved through Soroban assembly.
Set it to `0` only when you intentionally want no upper time bound.

Classic transactions support `G...` and `M...` sources. Stellar Core prohibits
muxed transaction and operation sources for Soroban `invokeHostFunction`
transactions; use a `G...` source there. A fee bump can still use an `M...`
outer fee source.

`fee` accepts the existing string form or an object that selects exactly one
strategy:

| Configuration          | Classic transaction                                                                                                                | Soroban transaction                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `"100"`                | Uses `100` as the per-operation base-fee bid                                                                                       | Uses `100` as the inclusion-fee bid because Soroban has one operation |
| `{ base: "100" }`      | Uses `100` per operation                                                                                                           | Uses `100` as the inclusion-fee bid                                   |
| `{ inclusion: "205" }` | Sets the transaction's total inclusion-fee bid to exactly `205`, including when it cannot be divided evenly by the operation count | Adds exactly `205` of inclusion fee to the simulated resource fee     |
| `{ max: "1000000" }`   | Caps and sets the complete classic transaction fee to `1000000`                                                                    | Caps the complete fee, including simulated resources, at `1000000`    |

Only one of `base`, `inclusion`, or `max` may be present. Colibri enforces the
same rule at runtime even when input enters through untyped JavaScript or
deserialized data.

For a Soroban `max` strategy, final assembly reads the resource fee from the
latest simulation result and uses the remaining capacity as the inclusion fee.
The maximum must cover the resource fee plus at least 100 stroops. Colibri does
not expose resource fees in `TransactionConfig` because they are produced by
simulation. Advanced callers and plugins can override the simulation-derived
value through the `resourceFee` input of the assembly processes.

The fee encoded in the submitted envelope is a bid. Stellar can charge less than
that bid when surge pricing does not require the entire amount. A maximum
therefore guarantees an upper bound, not the exact amount ultimately charged.

### Muxed Sources

Both `TransactionConfig.source` and `FeeBumpConfig.source` accept muxed
addresses. Colibri loads sequence state from the M-address's underlying
G-account, keeps the M-address in the transaction or fee-bump envelope, and
resolves signing requirements against the underlying G-account. The muxed ID is
routing information; it is not an independent on-chain signer.

```ts
const classicConfig: TransactionConfig = {
  source: signer.publicKey(),
  fee: { inclusion: "205" },
  timeout: 30,
  signers: [signer],
};

const sorobanConfig: TransactionConfig = {
  source: signer.publicKey(),
  fee: { max: "1000000" },
  timeout: 30,
  signers: [signer],
};
```

## Signers

One list can contain envelope signers, authorization-entry signers such as
`DelegatedSigner`, or signers that support both capabilities. The relevant
signing process narrows each value with `isEnvelopeSigner(...)`,
`isPreAuthTransactionSigner(...)`, or `isAuthEntrySigner(...)` before invoking
the capability.

`extraSigners` writes Stellar's exact signer-key precondition into the
transaction. Colibri later matches each key through `signer.signerKey()`. `T...`
pre-authorized transaction keys are excluded because they cannot contain their
own transaction hash recursively.

## Usage

```ts
import {
  createInvokeContractPipeline,
  HashXSigner,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Operation } from "npm:@stellar/stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");
const hashXSigner = HashXSigner.generateRandom(true);

const invokeContract = createInvokeContractPipeline({ networkConfig: network });

const result = await invokeContract({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "hello",
      args: [],
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: { max: "1000000" },
    timeout: 30,
    signers: [signer, hashXSigner],
    extraSigners: [hashXSigner.signerKey()],
  },
});
```

High-level clients use the same shape:

```ts
await contract.invoke({
  method: "transfer",
  methodArgs,
  config,
});
```

## Next Steps

- [Signer](signer/README.md) — Signer interface and implementations
- [DelegatedSigner](signer/delegated-signer.md) — CAP-71 signer topology
- [Pipelines](pipelines/README.md) — Write flows that accept `TransactionConfig`
