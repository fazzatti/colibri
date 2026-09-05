# SEP-29 memo requirements

`@colibri/plugin-sep29` checks whether a transaction is missing a memo required
by a receiving account. It uses RPC and can run as a standalone check or as an
opt-in plugin on the existing `send-transaction` step.

SEP-29 is a client convention, not a network validation rule. Its data entry
says **a memo is required**, not what the memo should contain. Obtain the memo
from the recipient before sending funds.

## Installation

```sh
deno add jsr:@colibri/core jsr:@colibri/plugin-sep29 npm:@stellar/stellar-sdk
```

## Complete Testnet example

Run with Deno's network permission (`deno run -A example.ts`). This creates two
disposable Testnet accounts. The first transaction opts the recipient into
SEP-29; the second sends a payment with a native SDK memo. No production keys or
assets are used.

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { createSep29Plugin } from "@colibri/plugin-sep29";
import { Asset, Memo, Operation } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const sender = LocalSigner.generateRandom();
const recipient = LocalSigner.generateRandom();
for (const signer of [sender, recipient]) {
  await initializeWithFriendbot(
    networkConfig.friendbotUrl,
    signer.publicKey(),
    {
      rpcUrl: networkConfig.rpcUrl,
    },
  );
}
const executeTransaction = createClassicTransactionPipeline({ networkConfig });
await executeTransaction({
  operations: [
    Operation.manageData({ name: "config.memo_required", value: "1" }),
  ],
  config: {
    source: recipient.publicKey(),
    signers: [recipient],
    fee: "100",
    timeout: 60,
  },
});

executeTransaction.use(createSep29Plugin());
const result = await executeTransaction({
  operations: [Operation.payment({
    destination: recipient.publicKey(),
    asset: Asset.native(),
    amount: "1",
  })],
  config: {
    source: sender.publicKey(),
    signers: [sender],
    fee: "100",
    timeout: 60,
    memo: Memo.id("29"), // In a real payment, use the memo supplied by the recipient.
  },
});
console.log(result.hash);
```

Removing `memo` from this payment causes `Sep29Errors.MEMO_REQUIRED` before
submission. Without the plugin, Colibri does not apply this policy. See
[Transaction Config](../../core/transaction-config.md) for memo forwarding.

## Standalone checker

This complete function accepts a native SDK transaction and client, so it can be
called outside Colibri's pipelines and before requesting signatures.

<!-- deno-check -->

```ts
import { checkMemoRequired, Sep29Errors } from "@colibri/plugin-sep29";
import type { FeeBumpTransaction, Transaction } from "npm:@stellar/stellar-sdk";
import type { Server } from "npm:@stellar/stellar-sdk/rpc";

export async function validatePayment(
  transaction: Transaction | FeeBumpTransaction,
  rpc: Server,
): Promise<void> {
  try {
    await checkMemoRequired({ transaction, rpc });
  } catch (error) {
    if (error instanceof Sep29Errors.MEMO_REQUIRED) {
      console.error(
        "Missing recipient memo",
        error.destination,
        error.operationIndex,
      );
    }
    throw error; // A lookup failure is not permission to submit unchecked.
  }
}
```

Alternatively pass `{ transaction, networkConfig }` using Colibri's
`NetworkConfig`. Supply either the network configuration or the RPC client, not
both. The plugin itself needs neither: it uses the submission step's client.

## Rules and limits

The check covers payment, both path-payment operations, and account merge. Muxed
destinations are exempt. With no memo, distinct G-destinations are read in one
RPC batch, by their known account-data keys. Only the exact single-byte ASCII
`"1"` value enables the requirement; absent accounts/data or other values do
not. There is no persistent cache and no Horizon lookup.

Any non-none memo passes, including empty text and ID zero. No RPC call is
needed when a memo exists or there are no relevant destinations. This says
nothing about whether the memo is correct or the transaction will succeed.

The checker never changes the envelope or signatures. For a fee bump it checks
the inner transaction. It composes with the fee-bump plugin in either order;
custom destination/memo-changing plugins should run **before** this guard. Calls
inspect current ledger state, not modifications within the pending transaction.
The requirement could change after the read. Custom plugin error handlers remain
application-owned; do not deliberately suppress these failures if you intend to
enforce the policy.

## Errors and receiving-account setup

The stable codes distinguish an unsupported transaction, invalid connection
setup, RPC/decoding failure, and required memo. A memo error identifies the
first relevant operation for the offending destination, using a zero-based
index. See the [error reference](../../reference/errors/plugins-sep29.md).

Receiving accounts opt in with
`Operation.manageData({ name:
"config.memo_required", value: "1" })` signed by
that account. Delete the entry with `value: null`. Setting the data consumes the
normal account-data reserve; the checker does not create or fund it.

[SEP-29](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md)
· [Package API](https://jsr.io/@colibri/plugin-sep29/doc)
