# DelegatedSigner

`DelegatedSigner` is Colibri's
[CAP-71-01](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071-01.md)
authorization-entry signer. It represents one top-level custom account and owns
the complete recursive `nestedDelegates` topology required by that account.

Only the top-level `DelegatedSigner` is added to the transaction configuration.
When `SignAuthEntries` supplies a recording-simulation entry, the signer:

1. converts it to delegated credentials with Stellar SDK primitives;
2. applies its optional top-level signature;
3. calls the same `signSorobanAuthEntry(...)` method recursively on each nested
   delegate;
4. returns one complete authorization entry.

## Constructing A Topology

```ts
import { DelegatedSigner, LocalSigner } from "@colibri/core";

const leafKey = LocalSigner.fromSecret("S...");

const leaf = new DelegatedSigner({
  address: leafKey.publicKey(),
  signer: leafKey,
});

const nestedContract = new DelegatedSigner({
  address: "CNESTED...",
  nestedDelegates: [leaf],
});

const accountSigner = new DelegatedSigner({
  address: "CACCOUNT...",
  nestedDelegates: [nestedContract],
});
```

The topology is assembled before invoking the pipeline because the application
knows the custom accounts' delegation policy. Colibri does not discover or guess
that policy during simulation.

Each node accepts:

| Property          | Type                             | Required | Description                                 |
| ----------------- | -------------------------------- | -------- | ------------------------------------------- |
| `address`         | `Ed25519PublicKey \| ContractId` | Yes      | Credential address represented by the node  |
| `signer`          | `AuthEntrySigner`                | No       | Produces this node's own signature value    |
| `nestedDelegates` | `DelegatedSignerNode[]`          | No       | Recursive delegates authorized by this node |

Omit `signer` when a custom account authorizes entirely through its delegates
and uses a void signature at that node.

## Invoking A Contract

```ts
const result = await contract.invoke({
  method: "withdraw",
  methodArgs: {
    token: "CNATIVE...",
    to: recipient.publicKey(),
    amount: 1_0000000n,
  },
  config: {
    source: feePayer.publicKey(),
    fee: "1000000",
    timeout: 30,
    signers: [feePayer, accountSigner],
  },
});
```

`feePayer` signs the transaction envelope. `accountSigner` matches the top-level
contract authorization entry and produces the delegated credential tree.

## Structural Guarantees

The constructor canonicalizes each immediate `nestedDelegates` array by the raw
Stellar address XDR order and rejects duplicate sibling addresses. Each
`DelegatedSigner` node applies the same rule to its own children, so a topology
composed from these nodes satisfies CAP-71's ordering and uniqueness rules
before signing begins.

Colibri does not interpret the account contract's delegation policy. During
`enforceSimulation`, the Stellar host enforces delegated-credential structure
and the account contract decides whether the supplied topology and signatures
are authorized. Any failure is surfaced before submission.

## Next Steps

- [Signer](README.md) — Signer capability interfaces
- [Invoke Contract Pipeline](../pipelines/invoke-contract.md) — Two-pass
  delegated authorization lifecycle
- [SignAuthEntries](../processes/sign-auth-entries.md) — Authorization routing
