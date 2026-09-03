# Addresses and account identities

Use `StrKey` for validation and branding, `NativeAccount` for classic account
identities, and the `address` namespace for muxed-address normalization. Parsing
an address is local: it does not prove that an account or contract exists.

<!-- deno-check -->

```ts
import { address, NativeAccount, StrKey } from "@colibri/core";
import { Keypair } from "npm:@stellar/stellar-sdk";

const publicKey = Keypair.random().publicKey();
if (!StrKey.isEd25519PublicKey(publicKey)) {
  throw new Error("Expected a G-address");
}

// A muxed address embeds an ID alongside a base G-address.
const account = NativeAccount.fromAddress(publicKey);
const muxed = account.muxedAddress("12345");
console.log(muxed);
console.log(address.muxedAddressToBaseAccount(muxed)); // Original G-address
```

The snippet creates an identity only; it neither funds nor writes an account.
For a validated `MuxedAddress`, call
`address.muxedAddressToBaseAccount(muxedAddress)` to obtain its underlying
Ed25519 account. The muxed ID is routing information, not a separate signing
key. Do not discard that ID when the destination service needs it.

## Related concepts

- [Account](account.md): the `NativeAccount` constructor and muxed ID options.
- [StrKeys](strkeys.md): validation and branded address types.
- [Authorization](authorization.md): account requirements versus exact signer
  keys.
- [WebAuth routing](../packages/webauth/discovery.md): protocol-specific
  restrictions.
- [Address errors](../reference/errors/core-address-muxed-to-base-account.md).
