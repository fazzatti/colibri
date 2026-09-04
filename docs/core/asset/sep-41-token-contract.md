# SEP-41 Token Contract

`SEP41TokenContract` is a high-level client for any deployed contract that
implements
[SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md).
It encodes the standard arguments directly and uses Colibri's normal read and
invoke pipelines, so it does not need to download the contract specification.

## Bind A Deployed Token

```ts
import { NetworkConfig, SEP41TokenContract } from "@colibri/core";

const token = new SEP41TokenContract({
  networkConfig: NetworkConfig.TestNet(),
  contractId: "C...",
});
```

The client accepts an optional preconfigured Stellar RPC `Server` and the same
metadata cache policy used by other high-level Colibri clients:

```ts
const token = new SEP41TokenContract({
  networkConfig,
  contractId,
  rpc,
  options: {
    cache: { enabled: true, ttl: 60_000 },
  },
});
```

Caching applies only to `decimals()`, `name()`, and `symbol()`.

## Read The Standard Interface

```ts
const decimals = await token.decimals();
const name = await token.name();
const symbol = await token.symbol();
const balance = await token.balance({ id: holder });
const allowance = await token.allowance({ from: holder, spender });
```

SEP-41 address inputs accept account (`G...`) and contract (`C...`) addresses.
The destination of `transfer` additionally accepts a muxed account (`M...`), as
required by the current standard.

## Transfer And Burn

Every write accepts a normal Colibri `TransactionConfig` and optional
preassembled Soroban authorization entries.

```ts
await token.transfer({
  from: holder,
  to: recipient,
  amount: 10_000_000n,
  config,
});

await token.burn({
  from: holder,
  amount: 1_000_000n,
  config,
});
```

`transferFrom` and `burnFrom` consume an allowance and require the spender's
authorization:

```ts
await token.transferFrom({
  spender,
  from: holder,
  to: recipient,
  amount: 5_000_000n,
  config: {
    ...config,
    signers: [transactionSourceSigner, spenderSigner],
  },
});
```

## Allowances

The expiration name follows SEP-41 directly: `liveUntilLedger` is encoded as the
contract's `live_until_ledger` `u32` argument.

```ts
const latest = await rpc.getLatestLedger();

await token.approve({
  from: holder,
  spender,
  amount: 50_000_000n,
  liveUntilLedger: latest.sequence + 100,
  config,
});
```

The implementing contract and network enforce the valid expiration range.

## Contract-Specific Methods

SEP-41 intentionally does not define mint, clawback, pause, administrator, or
other policy functions. `SEP41TokenContract` therefore does not imply a common
signature for them. The underlying `Contract` is public as `token.contract`.

If a specification is available, configure and use a general `Contract`. For a
small custom extension, encode the exact arguments and use the public raw escape
hatch:

```ts
import { nativeToScVal } from "stellar-sdk";

await token.contract.invokeRaw({
  operationArgs: {
    function: "mint_with_reference",
    args: [
      nativeToScVal(recipient, { type: "address" }),
      nativeToScVal(10_000_000n, { type: "i128" }),
      nativeToScVal("invoice-42", { type: "string" }),
    ],
  },
  config,
});
```

This keeps the standardized client strict without restricting contracts that
extend the token interface.

## Events

Use `SEP41Events` to recognize transfer, approve, burn, mint, and clawback
events. Parsers accept both legacy and v0.5.1 map representations, preserve
unknown map fields, and provide an opt-in runtime extension decoder.

See [SEP-41 events](../../events/standardized-events/sep-41.md).

## Errors

Missing required read results use the SEP-41 token error namespace. Lower-level
simulation, authorization, submission, and RPC failures retain the error of the
process that produced them.

See [every SEP-41 token error](../../reference/errors/core-asset-sep41-token.md)
and the [error-handling guide](../error.md).

## Related Clients

Use [StellarAssetContract](stellar-asset-contract.md) when a token is the
built-in wrapper for a classic Stellar asset and the application needs SAC-only
features such as trustline management or administrative asset controls.
