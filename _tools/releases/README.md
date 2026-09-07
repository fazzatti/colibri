# Reviewed independent releases

Use Deno **2.9.6** for this repository-only tooling. Nothing here publishes,
commits, pushes, or chooses a compatibility policy on your behalf. Native
`deno bump-version` is used only as an explicitly targeted manifest editor.

## Author workflow

1. Fetch `origin/main`, the released baseline. Run `deno task release:init`. If
   the plan already uses that baseline, existing cumulative intents are kept.
   Once the previous release is on main, initialization starts an empty plan.
2. Edit `plan.json`. Each affected package needs a reviewed `bump` and `reason`.
   Add `apiReview` when its public declarations change. Set a `dependencies`
   override only when a minimum dependency must change.
3. Run `deno task release:plan` to inspect the cumulative target versions and
   `deno task release:apply` to apply them. Re-running apply does not bump
   twice.
4. Update consumer documentation and run `deno task release:api:update` if
   public declarations changed. Review that generated diff; do not accept it
   merely because a tool generated it.
5. Run `deno task release:check --base origin/main`,
   `deno task release:api:check`, the consumer checks, and normal
   quality/package tests before requesting review.

Example intent for a compatible plugin feature requiring a new Core method:

```json
{
  "bump": "minor",
  "reason": "Add an optional plugin capability.",
  "apiReview": "Existing callers and custom plugins remain valid.",
  "dependencies": { "@colibri/core": "^1.2.0" }
}
```

Do not run an unscoped workspace bump. The target version is always calculated
from the plan's immutable base commit, not from a manually changed manifest or
the latest commit subject. A manifest already at the target is kept; a different
manual version is rejected for explicit reconciliation. Unknown packages,
dependency names, missing intents, excluded Core versions, and stale main
baselines fail validation. Starting a brand-new package requires establishing
its initial manifest/baseline explicitly; this tool does not guess a launch
version.

## Dependency behavior

Discovery reuses `_tools/package-inventory.ts`. Root/member import aliases and
published source changes are considered, including root-only SDK/Convee changes.
Tests alone do not force a package release. Published README/license changes do.
Compatibility decisions still need review: file detection cannot know that a new
implementation needs a higher Core floor or changes a default.

A Core 1.1.0 release leaves a plugin's existing `^1.0.0` range and version alone
when it remains sufficient. Adopting Core 2.x fails until the dependent has a
reviewed intent and explicit range. A dependency-only edit can still be
breaking; the tooling never automatically labels it a patch.

`release:apply` also synchronizes Build Verification's runtime version constant.
The existing invariant test and documentation checks remain required. Keep the
lockfile convention of the repository; isolated consumers resolve their own
dependency graphs and log the selected versions.

## Declaration review

`public-api.json` is a normalized Deno 2.9.6 declaration snapshot of all
declared entrypoints. It retains signatures, generics, overload order, literals,
and visibility while omitting source-machine paths and JSDoc prose. Public
namespace objects such as `steps` and error registries include their members,
not only the name of a `typeof` alias. CI compares the candidate with this
reviewed snapshot and reports changes against the plan's released baseline.
Generation explicitly disables terminal colors, including colors embedded by
Deno inside JSON template-type representations. Literal values are preserved;
the checker does not sanitize or ignore actual public type content.

`release:api:check` writes a JSON report to stdout on success and failure. It
includes released-baseline `changes`, `unreviewed` declarations, and an `error`
message if validation fails. Lists may be incomplete when generation or an
earlier check fails; the error is authoritative. Failed checks keep their
non-zero exit status and original diagnostic stack on stderr. CI uploads the
report even after failure, unless the run was cancelled or the check was
skipped.

Changed public declarations require `apiReview`. Removal of an exported symbol
from a stable package requires a major intent. Other changes need human review:
the tool is not an assignability or semantic-version oracle. In particular,
runtime defaults, external dependency types, and the semantics of structured
errors require consumer fixtures and normal tests as well. Auxiliary/internal
declarations may be reported conservatively; their visibility does not authorize
a silent change to a public signature.

Keep `_tools/consumers/v1/` consumers working rather than rewriting them when a
later implementation breaks. Add new versioned fixtures for additive APIs.
Intentional breaking changes require a major and an explicit migration review.

## CI and publishing

- Early quality checks run the release tests, baseline validation, API review,
  architecture, lint, public type checks, JSR checks, and documentation checks.
- Lightweight runtime/browser/Core-range jobs run in parallel. npm test
  artifacts are prepared once per SDK selection and reused across
  Node/TypeScript lanes.
- Existing package integration suites, coverage aggregation, and CRAP 15 gates
  remain separate from consumer evidence. The implementation target is 100%
  coverage; the existing Codecov YAML policy is unchanged.
- Publishing remains an explicit merge-to-main workflow using JSR provenance and
  package-specific tags. It revalidates the cumulative plan against the push's
  pre-change main commit (`github.event.before`), so an already-used plan cannot
  approve another push without renewed release review. It checks actual JSR
  distributions after publication. A failure after publication requires a
  corrective release; it cannot undo or overwrite an immutable package version.

Deno's 24-hour dependency-age policy stays active. The exact reviewed Convee
2.1.0 integration is exempted so new releases can be tested immediately. The
post-publication consumer also exempts the explicitly selected Colibri versions
it has just published. These exceptions do not widen dependency version ranges.
No global runtime, registry, or user configuration is changed by these tools.
