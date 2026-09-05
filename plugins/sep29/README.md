# @colibri/plugin-sep29

[Documentation](https://fifo-docs.gitbook.io/colibri/packages/plugins/sep29) |
[API reference](https://jsr.io/@colibri/plugin-sep29/doc)

Opt-in
[SEP-29 account memo requirements](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md)
for native Stellar transactions. Check a built transaction directly or attach a
guard to a Colibri pipeline's `send-transaction` step. Uses Stellar RPC through
Core's ledger-entry reader; no Horizon dependency.

## Install

```sh
deno add jsr:@colibri/core jsr:@colibri/plugin-sep29 npm:@stellar/stellar-sdk
```

## Attach to a pipeline

This fragment assumes your application has a funded `sender` (`LocalSigner` or
another envelope signer), a recipient G-address, and that recipient's memo.
Obtain the memo from the recipient; SEP-29 cannot determine the correct value.

```ts
import { createClassicTransactionPipeline, NetworkConfig } from "@colibri/core";
import { createSep29Plugin } from "@colibri/plugin-sep29";
import { Asset, Memo, Operation } from "npm:@stellar/stellar-sdk";

const sendPayment = createClassicTransactionPipeline({
  networkConfig: NetworkConfig.TestNet(),
});
sendPayment.use(createSep29Plugin());

const result = await sendPayment({
  operations: [
    Operation.payment({ destination, asset: Asset.native(), amount: "1" }),
  ],
  config: {
    source: sender.publicKey(),
    signers: [sender],
    fee: "100",
    timeout: 60,
    memo: Memo.id("12345"), // Native SDK Memo, not a Colibri wrapper.
  },
});
console.log(result.hash);
```

The plugin takes no connection arguments: it uses the submission step's RPC
client. It returns the same input object and does not modify the transaction,
its signatures, destinations, or memo. Omit the plugin to retain the pipeline's
existing behavior; no mandatory check is installed automatically.

## Check without a pipeline

`transaction` below is a built native `Transaction` or `FeeBumpTransaction`. The
checker does not require signing and does not submit anything.

```ts
import { checkMemoRequired } from "@colibri/plugin-sep29";
import { NetworkConfig } from "@colibri/core";
import { Server } from "npm:@stellar/stellar-sdk/rpc";

// Use an existing native RPC client (including its configured headers).
await checkMemoRequired({ transaction, rpc: new Server(rpcUrl) });

// Or use Colibri's existing network configuration. Choose one connection path.
await checkMemoRequired({
  transaction,
  networkConfig: NetworkConfig.TestNet(),
});
```

Success resolves to `undefined`. A required but missing memo throws
`Sep29Errors.MEMO_REQUIRED`, with `destination` and zero-based `operationIndex`.
Connection setup and lookup failures have separate codes and prevent submission
rather than silently skipping validation. Catch through `Sep29Errors` or
`ColibriError.code`; the exported `Code` and `ERROR_PLG_SEP29` enumerate errors.

## Exact scope

- Covers payment, strict-send path payment, strict-receive path payment, and
  account merge. Other operations are outside SEP-29.
- Skips M-address destinations, even if their base G-account requires a memo.
- With no memo, queries each distinct G-destination's `config.memo_required`
  account-data key once per check, in one RPC batch. Exactly ASCII `"1"` (one
  byte, 49) enables the requirement. No cross-run cache is kept.
- Missing data or accounts and other values do not enable the requirement. A
  passing check does **not** mean the destination exists or the payment is
  valid.
- Any non-none memo satisfies presence: text, ID, hash, or return hash,
  including empty text and ID zero. It does not validate content or memo type.
- A memo or no relevant destinations avoids the RPC lookup entirely.
- Fee-bump checks use the inner transaction. The fee source is not a
  destination. This guard works before or after the fee-bump plugin. Place it
  after any custom plugin that changes destinations or memos, so it checks the
  final ones.
- It reads current ledger state, not hypothetical state after operations in this
  transaction. The recipient can change its data later. This is a client
  safeguard, not consensus enforcement, simulation, or a payment-validity proof.

## Enable the convention on a receiving account

Include this native operation in a transaction signed by that account:

```ts
Operation.manageData({
  source: receivingAccount,
  name: "config.memo_required",
  value: "1",
});
```

Use `value: null` to remove the data entry. This operation incurs Stellar's
normal reserve requirements; the plugin does not configure accounts for you.
