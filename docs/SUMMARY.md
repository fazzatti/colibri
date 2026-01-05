# Table of contents

- [Introduction](README.md)

## Getting Started

- [Installation](getting-started/installation.md)
- [Quick Start](getting-started/quick-start.md)
- [Architecture Overview](getting-started/architecture.md)

## @colibri/core

- [Core](core/overview.md)
  - [Account](core/account.md)
  - [Asset](core/asset/README.md)
    - [SEP-11](core/asset/sep-11.md)
    - [Stellar Asset Contract](core/asset/stellar-asset-contract.md)
  - [Contract](core/contract.md)
  - [Network](core/network.md)
  - [SEP-1](core/sep1.md)
  - [Signer](core/signer/README.md)
    - [LocalSigner](core/signer/local-signer.md)
  - [Transaction Config](core/transaction-config.md)
  - [StrKeys](core/strkeys.md)
  - [TOID](core/toid.md)
  - [Tools](core/tools/README.md)
    - [Friendbot](core/tools/friendbot.md)
  - [Pipelines](core/pipelines/README.md)
    - [Invoke Contract](core/pipelines/invoke-contract.md)
    - [Read From Contract](core/pipelines/read-from-contract.md)
    - [Classic Transaction](core/pipelines/classic-transaction.md)
  - [Processes](core/processes/README.md)
    - [BuildTransaction](core/processes/build-transaction.md)
    - [SimulateTransaction](core/processes/simulate-transaction.md)
    - [AssembleTransaction](core/processes/assemble-transaction.md)
    - [SignAuthEntries](core/processes/sign-auth-entries.md)
    - [EnvelopeSigningRequirements](core/processes/envelope-signing-requirements.md)
    - [SignEnvelope](core/processes/sign-envelope.md)
    - [SendTransaction](core/processes/send-transaction.md)
    - [WrapFeeBump](core/processes/wrap-fee-bump.md)
  - [Error Handling](core/error.md)
  - [Events](events/overview.md)
    - [Event Filter](events/event-filter.md)
    - [Standardized Events](events/standardized-events/README.md)
      - [SAC](events/standardized-events/sac.md)
      - [SEP-41](events/standardized-events/sep-41.md)

## @colibri/event-streamer

- [Event Streamer](packages/event-streamer.md)

## @colibri/sep10

- [SEP-10](packages/sep10.md)

## Plugins

- [Plugins](packages/plugins/README.md)
  - [Fee Bump](packages/plugins/fee-bump.md)

## Examples

- [Examples Repository](https://github.com/fazzatti/colibri-examples)
