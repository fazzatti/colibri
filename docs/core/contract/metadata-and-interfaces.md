# Metadata, claims, and contract interfaces

[Contract overview](../contract.md)

Colibri separates three questions that are related but not equivalent:

1. What metadata did the contract embed under SEP-46?
2. Which standards does that metadata claim under SEP-47?
3. Does the contract's SEP-48 specification structurally match a known
   interface?

A declaration is informational. It does not prove that the implementation
matches the claimed interface, and an interface match does not invent a
declaration that the Wasm did not contain. Colibri therefore does not return a
single `compliant` or `valid` flag that conflates these results.

## Extract metadata and claims

`extractContractMetadata()` reads every `contractmetav0` custom section. It
preserves section order, entry order, repeated keys, and empty sections so that
the consumer can apply the aggregation rule for each metadata key.

```ts
import {
  claimsSep,
  extractContractMetadata,
  extractSepClaims,
} from "@colibri/core";

const wasm = await Deno.readFile("./contract.wasm");
const metadata = extractContractMetadata(wasm);
const claims = extractSepClaims(metadata);

console.log(metadata.entries);
console.log(claims.seps);
console.log("Claims SEP-41:", claimsSep(claims, 41));
console.log("Malformed declarations:", claims.invalidClaims);
```

SEP-47 permits declarations across repeated `sep` metadata entries. The analysis
keeps every valid occurrence in `claims`, provides a first-seen unique list in
`seps`, and keeps malformed comma-separated items in `invalidClaims`. Malformed
declarations are diagnostics rather than valid claims; they do not prevent
unrelated valid declarations from being read.

## Analyze a contract interface

`extractContractSpec()` reads all `contractspecv0` sections into the Stellar
SDK's `Spec`. Pass the spec and a versioned provider to
`analyzeContractInterface()` for diagnostics, or use
`matchesContractInterface()` when only the boolean result is needed.

```ts
import {
  analyzeContractInterface,
  ContractStandards,
  extractContractSpec,
  matchesContractInterface,
} from "@colibri/core";

const spec = extractContractSpec(wasm);
const provider = ContractStandards.SEP41.latest;

const analysis = analyzeContractInterface(spec, provider);
console.log(analysis.matches);
console.log(analysis.missingFunctions);
console.log(analysis.incompatibleFunctions);
console.log(analysis.additionalFunctions);

const matches = matchesContractInterface(spec, provider);
```

The matcher compares:

- required function names;
- parameter names, order, and types;
- output order and types;
- required user-defined struct, union, enum, and error-enum shapes; and
- reusable constrained types, such as SEP-50's implementation-selected unsigned
  integer types.

Documentation strings and Rust library labels are not ABI requirements.
Additional contract functions and user-defined types are reported but do not
make a match fail, because interface standards permit implementation-specific
extensions unless the standard says otherwise.

## Inspect several standards together

`inspectContractStandards()` parses the Wasm once and returns one result for
each supplied provider, in the same order. Each result contains an independent
`claim` and `interface` analysis.

```ts
import { ContractStandards, inspectContractStandards } from "@colibri/core";

const report = inspectContractStandards({
  wasm,
  standards: [
    ContractStandards.SEP41.latest,
    ContractStandards.SEP44.latest,
    ContractStandards.SEP56.latest,
  ],
});

for (const result of report) {
  console.log({
    sep: result.standard.sep,
    version: result.standard.version,
    declared: result.claim.declared,
    matches: result.interface.matches,
  });
}
```

This preserves useful combinations such as:

| Claim   | Interface | Meaning                                                                |
| ------- | --------- | ---------------------------------------------------------------------- |
| present | matches   | The Wasm declares the SEP and has the required ABI shape               |
| present | differs   | The declaration exists, but the ABI differs from this provider version |
| absent  | matches   | The ABI matches even though the Wasm did not declare the SEP           |
| absent  | differs   | Neither signal supports this provider                                  |

The interface result establishes structural compatibility only. It does not
prove runtime semantics, authorization policy, event behavior, or contract
correctness.

## Use the `Contract` conveniences

When the Wasm is already attached to a `Contract`, the same operations are
available without passing the bytes repeatedly:

```ts
import { Contract, ContractStandards, NetworkConfig } from "@colibri/core";

const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { wasm },
});

const metadata = contract.getMetadata();
const claims = contract.getSepClaims();
const claimsToken = contract.claimsSep(41);
const tokenAnalysis = contract.analyzeInterface(
  ContractStandards.SEP41.latest,
);
const matchesToken = contract.matchesInterface(
  ContractStandards.SEP41.latest,
);
const standards = contract.inspectStandards([
  ContractStandards.SEP41.latest,
  ContractStandards.SEP44.latest,
]);
```

These operations require local Wasm. A client configured from a contract ID,
Wasm hash, or external executable reference can call `loadSpecFromNetwork()`
first; that method resolves and stores the current network Wasm as well as its
specification.

## Bundled interface providers

`latest` means the newest version bundled with the installed Colibri release; it
does not fetch a mutable definition at runtime. Use `versions` when an
integration must test an explicit historical version.

| Standard                                                                                | Bundled latest | Provider shape                                                        |
| --------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- |
| [SEP-40](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md) | `0.1.0`        | Price Feed                                                            |
| [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) | `0.5.1`        | Token; versions `0.1.0` through `0.5.1` remain selectable             |
| [SEP-44](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0044.md) | `0.2.1`        | Token Memo Extension; `0.1.0`, `0.2.0`, and `0.2.1` remain selectable |
| [SEP-50](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md) | `0.1.0`        | Non-Fungible Token                                                    |
| [SEP-56](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) | `0.1.2`        | Tokenized Vault; `0.1.0`, `0.1.1`, and `0.1.2` remain selectable      |
| [SEP-57](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md) | `0.3.0`        | RWA Token plus six separately deployed component interfaces           |

SEP-57 defines a component architecture rather than one deployable ABI.
`ContractStandards.SEP57.latest` selects its primary RWA Token interface. Every
component is also available explicitly:

```ts
const providers = ContractStandards.SEP57.interfaces;

providers.rwaToken.latest;
providers.identityVerifier.latest;
providers.compliance.latest;
providers.claimTopicsAndIssuers.latest;
providers.identityRegistryStorage.latest;
providers.identityClaims.latest;
providers.claimIssuer.latest;
```

The registry contains the interfaces defined by the referenced SEP versions; it
does not add interfaces for standards that define only behavior, metadata,
transport, or discovery rules.

When one standard depends on another, inspect both providers explicitly. For
example, SEP-56 requires the vault itself to implement SEP-41, so a complete
structural assessment supplies both `SEP56.latest` and `SEP41.latest`. Colibri
does not silently merge dependent interfaces because each SEP has an independent
claim and version boundary.

## Failure behavior

Invalid Wasm, malformed metadata XDR, malformed spec XDR, and invalid requested
SEP identifiers raise occurrence-specific errors from `ERRORS_CONTR`. A
structural mismatch is an expected analysis result and does not throw.

See the upstream
[SEP-46 metadata](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0046.md),
[SEP-47 discovery](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0047.md),
and
[SEP-48 interface specification](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0048.md)
documents for the protocol definitions.
