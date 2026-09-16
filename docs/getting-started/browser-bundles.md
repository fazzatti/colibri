# Lightweight browser imports

Core 1.1 adds supported subpaths for consumers that only need errors or address
utilities. Identicon 1.1 adds a renderer for applications that only need SVG.
Use these public entrypoints to keep transaction, RPC and PNG encoding code out
of those consumers.

Install `@colibri/core` and `@colibri/identicon` as described in
[Installation](installation.md). Subpaths belong to those packages; they are not
separate dependencies.

<!-- deno-check -->

```ts
import { ColibriError } from "@colibri/core/errors";
import { StrKey } from "@colibri/core/strkey";
import { identiconSvg } from "@colibri/identicon/svg";

const address = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
try {
  console.log(StrKey.isValidEd25519PublicKey(address));
  const svg = identiconSvg(address, { size: 224, padding: 14 });
  console.log(svg);
} catch (error) {
  if (error instanceof ColibriError) console.error(error.toJSON());
  else throw error;
}
```

`ColibriError` and `StrKey` are the same implementations exported by the Core
root. Mixing supported imports preserves constructor identity and `instanceof`.
The SVG function produces exactly the same string and structured validation
errors as `new Identicon(address).toSvg(options)`. It shares the generator,
option validation and SVG renderer, and does not import PNG encoding. The class
continues to support synchronous PNG and data URLs.

The full Core root retains some initialization even when most exports are
unused. Its memoized classes and built-in contract standards remain available
with their existing behavior. Bundle sizes depend on the bundler and dependency
versions; measure your production application. Listing a module in a bundler's
dependency graph does not establish that its code survives tree shaking.

## Soroban value helpers

Use a direct namespace import when only selected value helpers are needed:

<!-- deno-check -->

```ts
import * as SorobanType from "@colibri/core/values";

const role: SorobanType.Symbol = "ADMIN";
const value = SorobanType.Symbol.from(role);
console.log(value.toXdr("base64"));
```

The root's named `SorobanType` namespace remains convenient for contract
clients. Deno 2.9.6 retains the whole forwarded namespace when using
`import { SorobanType } from "@colibri/core/values"`; the direct namespace
import above lets it discard unused members. Both forms share the same codec and
error implementations. Production checks measure both forms through Deno and
Rollup. See [Soroban types](../core/contract/values.md) for validation and
custom schemas.

## Contract specs through Core

Generated clients can import their spec constructor and result type from Core:

<!-- deno-check -->

```ts
import { type Result, Spec } from "@colibri/core";

const spec = new Spec([]);
console.log(spec.funcs());
const unwrap = (result: Result<number>): number => result.unwrap();
console.log(unwrap);
```

`Spec` is the native Stellar SDK constructor, including its static methods;
`Result` is its native decoded result type. Existing SDK specs remain accepted
by contracts and spec-based error/event helpers. No conversion or second spec
implementation is introduced. Generated packages declare only Core as their
runtime dependency; Core still depends on the Stellar SDK internally.

See the exact API references for
[errors](https://jsr.io/@colibri/core/doc/errors),
[StrKey](https://jsr.io/@colibri/core/doc/strkey),
[SVG rendering](https://jsr.io/@colibri/identicon/doc/svg), and
[Core](https://jsr.io/@colibri/core/doc).

## React and granular Core workflows

Core 1.2 adds public feature entrypoints: `/network`, `/rpc`, `/ledger`,
`/contract`, `/contract-read`, `/classic-transaction`, `/soroban-transaction`,
`/simulation`, `/assets`, `/events`, `/signers` and `/sep1`. Existing root
imports remain supported. Installing Core still installs its package
dependencies; browser bundlers can discard runtime code that these entrypoints
do not use.

Use React's feature entrypoints in the [React guide](../packages/react.md).
Provider/connection and pure query utilities avoid transaction and contract
runtime imports. `useContractReadSpec` uses the standalone Core read action; its
retained pipeline builds and simulates without signing or sending. `useContract`
and generated-helper invocation preserve the supplied class and its complete
pipelines, so that client's own runtime cost still applies.

Assets and WebAuth defer heavier capabilities until used. The production bundle
check reports both standalone totals and split builds' initial/complete graphs.
Deferred code is included in the complete total. Precise results, dependency
locks and source maps are retained with the CI artifact; measure the production
application too, since shared dependencies change the incremental cost.
