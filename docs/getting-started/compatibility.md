# Compatibility and releases

Core, WebAuth, RPC Streamer, Identicon, Test Tooling, and the channel-account,
fee-bump, and SEP-29 plugins start their stable release lines at **1.0.0**.
Build Verification remains on **0.x** while its API continues to mature.
Packages have independent versions; matching version numbers are not a
requirement for using them together.

## What is stable in 1.x

The compatibility contract covers documented public exports, accepted inputs,
return types, error codes and documented programmatic error fields. It also
covers the extension points used to integrate Colibri into an application:

- Consumer-defined signers and optional signer capabilities.
- Supported class subclassing and public configuration types.
- Callable processes, steps, and pipelines, their stable IDs, and plugin
  targets.
- Documented lifecycle/hook ordering, cleanup, units, defaults, and transaction
  semantics, including fees, memos, sources, and authorization.
- Interoperability with native Stellar SDK operations, transactions, XDR values,
  specs, keys, and RPC clients within the supported dependency range.

An auxiliary type used in a public signature is part of that signature's
compatibility boundary, even if it is marked `@internal` to reduce generated
documentation noise. Private implementation files and undocumented deep imports
are not additional entrypoints. Human-readable error wording can improve without
changing an error's stable code or documented structured fields.

## Choosing a version change

| Change                                                                                                       | Release                        |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Compatible correction to documented behavior                                                                 | Patch, such as 1.0.1           |
| New optional method, standalone helper, standard, or capability                                              | Minor, such as 1.1.0           |
| Removed method/input, changed fee units/defaults, required signer method, or incompatible result/error shape | Major, such as 2.0.0           |
| Dropped supported runtime or broken native SDK/plugin interoperability                                       | Major for the affected package |

Adding a new member to a promised closed union can break exhaustive TypeScript
consumers. Protocol fields explicitly documented as extensible are different:
callers must continue to handle their documented unknown values. Compatibility
is reviewed from the consumer's perspective, not just from the number of changed
lines or the dependency's own version number.

Deprecations can be introduced in a minor release while the existing API keeps
working. Removal belongs to a later major. A Stellar SDK or Convee major update
requires an interoperability review; its version number alone does not determine
Colibri's bump. Colibri does not hide an incompatible SDK change behind a new
wrapper solely to avoid a major release.

## Dependency floors

A plugin using `@colibri/core@^1.0.0` can keep that dependency and its own
version when Core publishes a compatible 1.0.1 or 1.1.0. It does not need a
release merely to repeat Core's new version number.

If the plugin starts using a method introduced in Core 1.2.0, its next release
must require at least that version. A higher minimum can also be necessary to
guarantee a Core bug fix. Adopting Core 2.x requires a separate compatibility
decision for each dependent package.

Keep the native Stellar SDK version compatible throughout the application's
dependency graph. For npm consumers, avoid loading duplicate Core or Convee
instances when passing errors or runtime contexts across package boundaries. JSR
documents npm alias/deduplication limitations and recommends pnpm where
duplicate installations are a concern. See
[JSR npm compatibility](https://jsr.io/docs/npm-compatibility).

## Supported and tested integrations

| Surface                             | Compatibility boundary and CI checks                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Stellar JavaScript SDK              | `>=17.0.1 <18`; exact 17.0.1 and freshly resolved compatible 17.x                         |
| Convee                              | Exact 2.1.0; public composition and plugin lifecycle fixtures                             |
| Deno                                | Minimum 2.7.11 and 2.9.6; each runtime's bundled TypeScript compiler                      |
| Node.js                             | Minimum 22.12.0, current patched 22.x, and 24.x LTS                                       |
| TypeScript in npm consumers         | 5.9.3 and 6.0.3                                                                           |
| Browsers                            | Playwright-pinned Chromium, Firefox, and WebKit; actual engine versions appear in CI logs |
| Test Tooling and Build Verification | Deno and Docker integration; no Node/browser support promise from graduation alone        |

Use current patched supported runtimes in applications. The oldest runtime in
the matrix is a compatibility fixture, not a security recommendation. Browser
tests execute real SDK signing/binary operations, identicon rendering, and
callable pipeline/plugin composition. WebKit coverage is not a claim that every
Safari version or operating system was tested. Network operations still depend
on the provider's availability, protocol support, and browser CORS policy.

## How compatibility is checked

CI validates a reviewed release plan and normalized public declaration changes
early. Preserved 1.0 consumers compile and execute against candidate packages,
including native SDK objects, custom signers, subclassing, plugins, and typed
errors. Separate jobs exercise Deno, installed npm artifacts, and real browsers.

Dependent packages are also checked against the oldest available Core release
accepted by their range. Conversely, the earliest still-compatible dependent
release is checked against candidate Core. These use immutable Git release trees
in isolated import maps, without workspace substitution. During the first 1.0
release there is no prior compatible 1.x artifact: CI reports that bootstrap
explicitly, and historical checks begin once those release tags exist.

The normal package suites, integration tests, coverage aggregation, architecture
rules, and CRAP threshold remain in place. Consumer fixtures are additional
compatibility evidence, not coverage padding. After publication, another check
installs the actual JSR modules and JSR-generated npm distributions; pre-release
test artifacts are not presented as equivalent to the published artifacts.

No declaration tool can determine whether a changed default or runtime behavior
is compatible. The release diff and compatibility evidence still require review.

## Maintenance policy

Maintenance focuses on the current release line. There is no standing LTS
duration, automatic backport commitment, or set of older-major adapters. If a
concrete need for an older major arises, its scope and support approach will be
discussed separately. This does not relax the compatibility commitment within
the current stable major.
