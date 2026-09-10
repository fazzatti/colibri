# Repository test infrastructure

This directory is not part of any published Colibri package.

## Quickstart diagnostics

Run the WebAuth lifecycle or Core SDEX suite with
`COLIBRI_TEST_QUICKSTART_DIAGNOSTICS=1` to include Quickstart service logs and
the actual Docker image ID in test output. CI enables this and uploads
`webauth-quickstart-diagnostics` and `core-quickstart-diagnostics` even when
their suites fail, before container cleanup can erase the evidence. SDEX also
records the final container state before stopping it, including the exit status
and Docker's OOM flag. The WebAuth suite currently uses the mutable
`nightly-next` tag for its protocol 28 fixtures; compare image IDs and the
service versions in these logs when investigating intermittent RPC failures.
Challenge-recording errors include the RPC's simulation ledger. SDEX uses the
mutable `testing` tag. Diagnostics do not retry transactions or challenges, or
relax any assertions.

## Mainnet archive integrations

The CAP-67 and RPC Streamer integration suites read real Mainnet events and
historical ledgers. They use `mainnet-archive-config.ts`, not a public provider
catalog. Override its endpoints with:

- `COLIBRI_TEST_MAINNET_RPC_URL`: live Mainnet Stellar RPC endpoint.
- `COLIBRI_TEST_MAINNET_ARCHIVE_RPC_URL`: archive RPC endpoint supporting the
  historical ledger/event ranges asserted by the suites.

The defaults retain the existing public Lightsail endpoints used by these tests.
Endpoint availability, retention and rate limits remain external test
dependencies; these tests are required and do not silently skip or switch
providers on failure. Run the RPC Streamer integrations serially, as in CI, to
avoid concurrent requests overwhelming the shared public archive endpoint.

These settings do not change the public `NetworkConfig.MainNet()` default, which
remains `https://mainnet.sorobanrpc.com`.
