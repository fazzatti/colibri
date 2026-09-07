# Repository test infrastructure

This directory is not part of any published Colibri package.

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
