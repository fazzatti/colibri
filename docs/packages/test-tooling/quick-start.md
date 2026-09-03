# Start a local ledger

[Test Tooling overview](../test-tooling.md)

## Quick Start

Save this complete script as `ledger.ts`, ensure Docker is running, and execute
`deno run -A ledger.ts`. Broad permissions are for host-side Docker discovery,
image/container operations, and HTTP readiness checks—not browser code.

<!-- deno-check -->

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger();

try {
  await ledger.start();

  const details = await ledger.getNetworkDetails();
  console.log(details.rpcUrl);
} finally {
  await ledger.stop();
  await ledger.destroy();
}
```

By default, `StellarTestLedger` starts a local standalone Quickstart container
with:

- `containerImageVersion: "latest"`
- `network: NetworkEnv.LOCAL`
- `limits: ResourceLimits.TESTNET`
- `enabledServices: ["core", "horizon", "rpc"]`
- ephemeral storage

`start()` waits only for the services implied by the selected network and
enabled services. For the default local setup, that means Horizon, Soroban RPC,
and Friendbot are ready before `start()` resolves.

To use the result with Core, pass the returned network details into
`NetworkConfig.CustomNet(details)`. Run all application work inside the `try`
block before cleanup. `getNetworkDetails()` returns the selected service URLs
and passphrase; it does not create or fund a transaction signer for you.

Use unique `containerName` values when running independent suites concurrently.
Read [lifecycle and reuse](lifecycle.md) before attaching to an existing ledger.
