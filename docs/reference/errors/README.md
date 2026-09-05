# Error code reference

Every declared error code in the published package source is listed here,
grouped by its owning context. A declaration does not guarantee that every code
is emitted by the current implementation. Source links identify the definition;
use the [error-handling guide](../../core/error.md) for catch and recovery
patterns.

These pages are source-derived. They include internal contexts that can surface
through a public call; source paths are **not** importable package subpaths.

`GEN_000` is Core's fallback for `ColibriError.unexpected()` and
`ColibriError.fromUnknown()` when the caller supplies no code. Callers can also
supply their own codes; those application-defined values are outside this
catalog.

## @colibri/build-verification

- [build-verification/error/core](build-verification-error-core.md) — 7 codes.
- [build-verification/providers/target](build-verification-providers-target.md)
  — 8 codes.
- [build-verification/providers/source](build-verification-providers-source.md)
  — 20 codes.
- [build-verification/archive](build-verification-archive.md) — 15 codes.
- [build-verification/providers/image](build-verification-providers-image.md) —
  12 codes.
- [build-verification/core/policy](build-verification-core-policy.md) — 4 codes.
- [build-verification/runners/docker](build-verification-runners-docker.md) — 21
  codes.
- [build-verification/artifacts](build-verification-artifacts.md) — 7 codes.
- [build-verification/reporting](build-verification-reporting.md) — 3 codes.
- [build-verification/processes/execute-contract-build](build-verification-processes-execute-contract-build.md)
  — 3 codes.
- [build-verification/pipelines/build-verification](build-verification-pipelines-build-verification.md)
  — 3 codes.
- [build-verification/processes/resolve-verification-target](build-verification-processes-resolve-verification-target.md)
  — 1 codes.
- [build-verification/processes/parse-contract-metadata](build-verification-processes-parse-contract-metadata.md)
  — 1 codes.
- [build-verification/processes/validate-build-recipe](build-verification-processes-validate-build-recipe.md)
  — 1 codes.
- [build-verification/processes/resolve-source-archive](build-verification-processes-resolve-source-archive.md)
  — 1 codes.
- [build-verification/processes/resolve-build-image](build-verification-processes-resolve-build-image.md)
  — 1 codes.
- [build-verification/processes/select-build-artifact](build-verification-processes-select-build-artifact.md)
  — 1 codes.
- [build-verification/processes/compare-contract-wasm](build-verification-processes-compare-contract-wasm.md)
  — 1 codes.
- [build-verification/cli](build-verification-cli.md) — 28 codes.

## @colibri/core

- [core/account/native](core-account-native.md) — 5 codes.
- [core/address/muxed-to-base-account](core-address-muxed-to-base-account.md) —
  3 codes.
- [core/asset/sac](core-asset-sac.md) — 5 codes.
- [core/asset/sep11](core-asset-sep11.md) — 1 codes.
- [core/asset/sep41-token](core-asset-sep41-token.md) — 20 codes.
- [core/auth/requirements/classic-operation-threshold](core-auth-requirements-classic-operation-threshold.md)
  — 2 codes.
- [core/common/helpers/boolean](core-common-helpers-boolean.md) — 1 codes.
- [core/common/helpers/bounded-array](core-common-helpers-bounded-array.md) — 1
  codes.
- [core/common/helpers/failed-simulation-response](core-common-helpers-failed-simulation-response.md)
  — 1 codes.
- [core/common/helpers/format-units](core-common-helpers-format-units.md) — 8
  codes.
- [core/common/helpers/get-transaction-response](core-common-helpers-get-transaction-response.md)
  — 5 codes.
- [core/common/helpers/string](core-common-helpers-string.md) — 1 codes.
- [core/common/helpers/transaction](core-common-helpers-transaction.md) — 2
  codes.
- [core/common/helpers/xdr](core-common-helpers-xdr.md) — 19 codes.
- [core/contract](core-contract.md) — 21 codes.
- [core/event](core-event.md) — 13 codes.
- [core/event/event-filter](core-event-event-filter.md) — 2 codes.
- [core/event/event-id](core-event-event-id.md) — 2 codes.
- [core/event/parsing](core-event-parsing.md) — 3 codes.
- [core/ledger-entries](core-ledger-entries.md) — 19 codes.
- [core/ledger-parser](core-ledger-parser.md) — 9 codes.
- [core/network](core-network.md) — 2 codes.
- [core/pipelines/classic-transaction](core-pipelines-classic-transaction.md) —
  3 codes.
- [core/pipelines/invoke-contract](core-pipelines-invoke-contract.md) — 4 codes.
- [core/pipelines/read-from-contract](core-pipelines-read-from-contract.md) — 3
  codes.
- [core/pipelines/shared/connectors/simulate-to-retval](core-pipelines-shared-connectors-simulate-to-retval.md)
  — 1 codes.
- [core/plugins/processes/simulate-transaction/contract-error-matcher](core-plugins-processes-simulate-transaction-contract-error-matcher.md)
  — 2 codes.
- [core/processes/assemble-for-enforcement](core-processes-assemble-for-enforcement.md)
  — 3 codes.
- [core/processes/assemble-transaction](core-processes-assemble-transaction.md)
  — 18 codes.
- [core/processes/build-transaction](core-processes-build-transaction.md) — 21
  codes.
- [core/processes/enforce-simulation](core-processes-enforce-simulation.md) — 4
  codes.
- [core/processes/envelope-signing-requirements](core-processes-envelope-signing-requirements.md)
  — 4 codes.
- [core/processes/parse-classic-transaction-outcome](core-processes-parse-classic-transaction-outcome.md)
  — 6 codes.
- [core/processes/send-transaction](core-processes-send-transaction.md) — 12
  codes.
- [core/processes/sign-auth-entries](core-processes-sign-auth-entries.md) — 8
  codes.
- [core/processes/sign-envelope](core-processes-sign-envelope.md) — 15 codes.
- [core/processes/simulate-transaction](core-processes-simulate-transaction.md)
  — 5 codes.
- [core/processes/wrap-fee-bump](core-processes-wrap-fee-bump.md) — 6 codes.
- [core/sep1](core-sep1.md) — 8 codes.
- [core/signer/delegated](core-signer-delegated.md) — 3 codes.
- [core/signer/hash-x](core-signer-hash-x.md) — 9 codes.
- [core/signer/local](core-signer-local.md) — 3 codes.
- [core/signer/pre-authorized-transaction](core-signer-pre-authorized-transaction.md)
  — 6 codes.
- [core/signer/signed-payload](core-signer-signed-payload.md) — 12 codes.
- [core/sponsorship](core-sponsorship.md) — 2 codes.
- [core/toid](core-toid.md) — 4 codes.
- [core/tools/friendbot](core-tools-friendbot.md) — 3 codes.

## @colibri/identicon

- [identicon](identicon.md) — 10 codes.

## @colibri/plugin-channel-accounts

- [plugins/channel-accounts/shared](plugins-channel-accounts-shared.md) — 4
  codes.

## @colibri/plugin-fee-bump

- [plugins/fee-bump](plugins-fee-bump.md) — 3 codes.

## @colibri/plugin-sep29

- [plugins/sep29](plugins-sep29.md) — 4 codes.

## @colibri/rpc-streamer

- [rpc-streamer](rpc-streamer.md) — 24 codes.

## @colibri/test-tooling

- [test-tooling/quickstart](test-tooling-quickstart.md) — 5 codes.

## @colibri/webauth

- [webauth](webauth.md) — 66 codes.
