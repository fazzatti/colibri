# Reserve sponsorship

`wrapSponsorship` composes native Stellar operations into a
`beginSponsoringFutureReserves` / operations / `endSponsoringFutureReserves`
block. The sponsor pays the reserve requirement for qualifying entries created
inside that block, without transferring XLM to the sponsored account.

This is **reserve sponsorship**, not transaction-fee sponsorship. Use the
[fee-bump plugin](../packages/plugins/fee-bump.md) when another account should
pay a transaction's fee. Both mechanisms can be used in the same transaction.

## Create a sponsored account and trustline

Install `@colibri/core` and `@stellar/stellar-sdk` as described in
[Installation](../getting-started/installation.md). This complete Deno example
uses Testnet and Friendbot. It generates disposable keys; do not use it to
manage production accounts.

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  wrapSponsorship,
} from "@colibri/core";
import { Asset, Operation } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const sponsor = LocalSigner.generateRandom();
const holder = LocalSigner.generateRandom();
await initializeWithFriendbot(
  networkConfig.friendbotUrl,
  sponsor.publicKey(),
  { rpcUrl: networkConfig.rpcUrl },
);

const executeClassicTransaction = createClassicTransactionPipeline({
  networkConfig,
});
const result = await executeClassicTransaction({
  operations: wrapSponsorship({
    sponsor: sponsor.publicKey(),
    sponsored: holder.publicKey(),
    operations: [
      // The transaction source creates the account, whose reserves are sponsored.
      Operation.createAccount({
        destination: holder.publicKey(),
        startingBalance: "0",
      }),
      // A trustline belongs to the holder: set this operation source explicitly.
      Operation.changeTrust({
        source: holder.publicKey(),
        asset: new Asset("DEMO", sponsor.publicKey()),
        limit: "1000",
      }),
    ],
  }),
  config: {
    source: sponsor.publicKey(),
    signers: [sponsor, holder],
    fee: "100",
    timeout: 60,
  },
});
console.log(result.hash, result.feeCharged, result.operations);
```

The returned array has four operations, so `fee: "100"` bids 400 stroops total.
The sponsored account must sign even when it is created within the transaction.
The sponsor must have sufficient available XLM for the reserves and fees.

## Composition and boundaries

- The helper returns an ordinary `xdr.Operation[]`, usable with either Colibri
  or `TransactionBuilder`. It does not submit anything or load account state.
- The begin operation has the explicit sponsor source (G or M address). The end
  operation has the sponsored G-account source.
- Inner operations retain their order and object identity. Their sources are
  never rewritten. An omitted source means the **transaction source**, not
  automatically the sponsored account.
- Include both accounts in the normal signer list. If other inner operations
  have different sources, include the corresponding authorizers too.
- Multiple independent sponsorship blocks can be concatenated in one
  transaction. Each adds two operations toward Stellar's 100-operation limit.
- Composition does not guarantee that every inner operation creates a
  sponsorable entry, that the reserve balance is sufficient, or that nested
  sponsorship is legal. Stellar enforces those protocol rules atomically.
- Existing sponsorship revocation and transfer remain explicit native SDK
  operations. The helper neither inserts them nor changes existing sponsors.

Invalid sponsor and sponsored-account addresses produce distinct
`SponsorshipErrors` with stable codes. Ledger and signing failures use the
normal pipeline errors. The helper is additive; no default pipeline behavior
changes when it is not used.

[CAP-33 specification](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0033.md)
and [API reference](https://jsr.io/@colibri/core/doc/~/wrapSponsorship).
