# @colibri/plugin-fee-bump

`@colibri/plugin-fee-bump` lets a separate account cover the network fees for a
transaction by wrapping the outgoing envelope in a fee-bump transaction.

It targets the `SendTransaction` step, so it can be attached to any pipeline
that includes `steps.SEND_TRANSACTION_STEP_ID`.

## Installation

```bash
deno add jsr:@colibri/plugin-fee-bump
```

## Quick Start

```ts
import {
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { Operation } from "npm:@stellar/stellar-sdk";

const userSigner = LocalSigner.fromSecret("USER_SECRET...");
const sponsorSigner = LocalSigner.fromSecret("SPONSOR_SECRET...");
const network = NetworkConfig.TestNet();

const invokeWithSponsor = createInvokeContractPipeline({
  networkConfig: network,
});

invokeWithSponsor.use(
  createFeeBumpPlugin({
    networkConfig: network,
    feeBumpConfig: {
      source: sponsorSigner.publicKey(),
      fee: "1000000",
      signers: [sponsorSigner],
    },
  }),
);

const result = await invokeWithSponsor({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "transfer",
      args: [],
    }),
  ],
  config: {
    source: userSigner.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [userSigner],
  },
});
```

## Public API

- `createFeeBumpPlugin(...)`
- `FEE_BUMP_PLUGIN_ID`
- `FEE_BUMP_PLUGIN_TARGET`
- `Code` and `ERROR_PLG_FBP`
- `FeeBumpPluginConfig`, `FeeBumpPluginNetworkConfig`, and `FeeBumpPluginArgs`
- `FeeBumpPluginSigner`
- `FeeBumpEnvelopeSigner`
- `FeeBumpPreAuthorizedTransactionSigner`
- `FeeBumpPluginSignerIdentity`
- `FeeBumpSignableTransaction`

The package also re-exports Core's branded signer-key and address types used by
custom fee-bump signers.

## Configuration

`createFeeBumpPlugin(...)` accepts:

| Property                | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `networkConfig`         | Network configuration used to build the wrapper                        |
| `feeBumpConfig.source`  | Stellar address that will pay the fee bump                             |
| `feeBumpConfig.fee`     | Base fee in stroops for the outer envelope                             |
| `feeBumpConfig.signers` | Envelope or pre-authorized transaction signers for the fee-bump source |

## How It Works

1. The pipeline reaches the `SendTransaction` step
2. The plugin intercepts the step input
3. It wraps the outgoing transaction in a fee-bump envelope
4. It signs that outer envelope with the configured sponsor signers
5. The wrapped transaction continues to `sendTransaction`

The inner transaction signatures are preserved. The outer source can use an
Ed25519, Hash-X, signed-payload, or exact pre-authorized transaction signer.

The outer `fee` remains the SDK's **base fee**, not Core's `{ max }` or
`{ inclusion }` strategy object. It must meet the network minimum and the inner
inclusion bid per operation, excluding Soroban resources. The SDK computes the
outer total as `base fee × (inner operation count + 1) + resource fee`. Inspect
the resulting envelope when budgeting; the string is not the final total. An
inner maximum does not cap the sponsor's outer fee.

### Resource controls and inner fee limits

Attaching the plugin explicitly opts into the sponsor's separately configured
inclusion bid. The inner transaction's `{ max }` strategy still governs its
assembly, including any resource overrides or padding. The plugin then wraps
that completed transaction without changing its resource declarations, resource
fee or signatures. It does not reprice or pad resources.

For example, a Soroban inner transaction with 35,000 stroops of adjusted
resource fee and `config.fee: { max: "35100" }` has a 100-stroop inclusion bid.
Choosing `feeBumpConfig.fee: "200"` produces an outer bid of
`35,000 + 200 × 2 = 35,400` stroops. Exceeding the inner maximum is the intended
result of the sponsor's fee choice. The inner resource fee remains 35,000. Equal
per-operation inclusion bids are also supported when only sponsorship is needed.
An insufficient inner maximum still fails during assembly before the plugin
runs.

See [transaction resources](../../core/resources.md) for choosing manual
resource control or explicitly calculated padding before fee-bump wrapping.

See [the channel/payment example](channel-accounts/example.md) for a complete
funded Testnet flow using this plugin.

## Errors

See [every code for this context](../../reference/errors/plugins-fee-bump.md)
and the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.

## Related Docs

- [Pipelines](../../core/pipelines/README.md)
- [WrapFeeBump](../../core/processes/wrap-fee-bump.md)
- [Signer](../../core/signer/README.md)
