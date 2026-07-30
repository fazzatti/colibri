# PreAuthorizedTransactionSigner

`PreAuthorizedTransactionSigner` represents a `T...` signer key containing one
exact network-bound transaction hash. It verifies the current transaction and
does not add a decorated signature to the envelope.

## Prepared Transaction Flow

1. Finalize the future transaction, including sequence, fee, operations, memo,
   preconditions, and network passphrase.
2. Create the signer.
3. Register its decoded 32-byte hash on the authorizing account in an earlier
   `setOptions` transaction.
4. Associate the signer with that account and run the prepared transaction.

```ts
import { Operation } from "stellar-sdk";
import { PreAuthorizedTransactionSigner, StrKey } from "@colibri/core";

const signer = PreAuthorizedTransactionSigner.fromTransaction(
  finalizedTransaction,
);

signer.signerKey(); // T...

const installSigner = Operation.setOptions({
  signer: {
    preAuthTx: StrKey.decodePreAuthTx(signer.signerKey()),
    weight: 1,
  },
});

// Submit installSigner with an existing account signer first.
signer.addTarget(accountId);

const output = await signEnvelope({
  transaction: finalizedTransaction,
  signatureRequirements,
  signers: [signer],
});
```

You can also restore an instance from a raw 32-byte transaction hash or an
existing key:

```ts
const fromHash = PreAuthorizedTransactionSigner.fromHash(hash);
const fromKey = PreAuthorizedTransactionSigner.fromHash("T...");
```

If the transaction changes, Colibri raises
`SEN_ERRORS.PRE_AUTH_TRANSACTION_MISMATCH` (`SEN_012`). Signatures already added
to the envelope do not change the transaction hash, so a pre-authorized signer
can be checked after other envelope signers.

When the matching transaction is applied, Stellar automatically removes the
`T...` signer from the account even if an operation fails. If the transaction is
never applied, the signer remains and must be removed explicitly when it is no
longer needed.

Pre-authorized transaction keys cannot be `extraSigners`: embedding the `T...`
key as a precondition would make its hash recursively depend on itself.
