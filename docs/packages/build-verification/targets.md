# Targets and verification results

[Contract Build Verification overview](../build-verification.md)

## Verify a deployed contract

```typescript
import { ContractBuildVerifier } from "@colibri/build-verification";
import { NetworkConfig } from "@colibri/core";

const verifier = new ContractBuildVerifier({
  network: { networkConfig: NetworkConfig.MainNet() },
});

const result = await verifier.verify({
  target: { contractId: "C..." },
});
```

Strict mode uses the contract's own `bldimg`, ordered `bldarg`, `bldopt`,
`source_uri`, and `source_sha256` metadata. The exact source archive is hashed
before safe extraction, and the rebuilt Wasm is selected without guessing.

## Four target forms

| Input                             | Resolution                                      | Network needed? |
| --------------------------------- | ----------------------------------------------- | --------------- |
| `{ wasm: bytes }`                 | Exact `Uint8Array` supplied by your application | No              |
| `{ wasmHash: hash }`              | Uploaded contract-code entry by hash            | Yes             |
| `{ contractId }`                  | Current contract instance, then its executable  | Yes             |
| `{ externalRef: { owner, tag } }` | CAP-85 owner/tag mapping, then its code         | Yes             |

Each form optionally accepts `label`. Choose one form, not a mixture. `tag` can
be text or bytes as defined by Core's `ExternalExecutableRef`. A contract whose
executable is a reference follows the same resolution path automatically.

An owner/tag mapping and a deployed contract's executable can change. Evidence
records the resolved hash and ledger observations; it proves the bytes observed
for that run, not all future versions at the same address. Use a Wasm hash when
you specifically intend an immutable code identity.

Direct Wasm targets need no network. Contract IDs and Wasm hashes accept either
a Colibri network configuration, an existing compatible RPC reader plus a
passphrase, or an RPC URL plus a passphrase:

```typescript
new ContractBuildVerifier({
  network: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
});
```

## Interpret the result

```typescript
switch (result.status) {
  case "verified":
    console.log(result.evidence);
    break;
  case "mismatch":
    console.log(result.evidence.artifact?.sha256);
    break;
  case "notApplicable":
    console.log(result.reason);
}
```

Operational failures throw typed Colibri errors with stable `BLDV_*` codes.
`mismatch` is returned only after a build completes and raw-byte comparison is
possible.

`notApplicable` covers targets such as a native Stellar Asset Contract and
strict targets without a usable SEP-58 recipe. It is not successful
verification. A `verified` result is byte equality after rebuilding; it is not
an audit of the contract, an attestation, or proof that its logic is safe.

For a one-shot call, `verifyContractBuild(input, options?)` uses the same
workflow as the reusable `ContractBuildVerifier`. Reuse a verifier when several
runs share network, policies, providers, runner, or reporting configuration.

In `0.3.0`, the former catch-all `INVALID_CLI_ARGUMENTS` (`BLDV_031`) code was
replaced by occurrence-specific CLI errors in the `BLDV_106` through `BLDV_131`
range. Consumers should handle the precise error code; there is no single
replacement for every formerly invalid CLI argument.
