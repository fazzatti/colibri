# StrKeys

StrKeys encode Stellar keys and identifiers with a type prefix. Core adds
branded TypeScript types and two distinct levels of validation.

## Format guards versus checksum validation

| Purpose                     | Examples                                                                                      | What it establishes                                      |
| --------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Quick format/type narrowing | `isEd25519PublicKey`, `isContractId`, `isMuxedAddress`                                        | Prefix, alphabet, and length; **not** checksum validity  |
| Format plus checksum        | `isValidEd25519PublicKey`, `isValidContractId`, `isValidMuxedAddress`                         | Structurally valid encoded value; not on-chain existence |
| Other encoded kinds         | `isPreAuthTx`, `isSha256Hash`, `isSignedPayload`, `isLiquidityPoolId`, `isClaimableBalanceId` | The documented format guard for that kind                |

Checksum-aware variants also exist for secret seeds, signed payloads, liquidity
pools, and claimable balances. Use the
[API reference](https://jsr.io/@colibri/core/doc) for the exact names; for
example, the secret-seed validator is `isValidEd25519SecretSeed`, while its
format guard is `isEd25519SecretKey`.

## Validate application input

Install Core and run this complete local script with `deno run address.ts`.
There is no network request.

<!-- deno-check -->

```ts
import { NativeAccount, StrKey } from "@colibri/core";

const input = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
if (StrKey.isValidEd25519PublicKey(input)) {
  // The guard both checks the checksum and narrows input's type.
  const account = NativeAccount.fromAddress(input);
  console.log(account.address());
} else {
  console.error("Expected a checksummed Stellar G-address");
}
```

A format guard may accept a key whose checksum is wrong. Neither level proves
that an account is funded, that a contract is deployed, or that the user
controls a private key. Read the network or perform the relevant authorization
separately.

Do not infer address ownership from its prefix, and never log an input that may
contain a secret seed. For muxed-account normalization and embedded IDs, see
[address helpers](address.md). For exact signer keys in transaction
preconditions, see [signers](signer/README.md).
