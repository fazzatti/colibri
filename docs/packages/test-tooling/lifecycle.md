# Persistence and container reuse

[Test Tooling overview](../test-tooling.md)

## Persistent Mode

Use `storage` to switch from the default ephemeral container to a mounted
persistent volume:

```typescript
import {
  QuickstartStorageModes,
  StellarTestLedger,
} from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  storage: {
    mode: QuickstartStorageModes.PERSISTENT,
    hostPath: "/absolute/path/to/stellar-data",
  },
});
```

Persistent mode mounts `hostPath` into `/opt/stellar`.

Use it carefully:

- Quickstart's on-disk layout can change between image releases
- first-time initialization of an empty persistent directory can be more
  operationally sensitive than ephemeral mode
- pinned image tags are safer than moving tags when reusing persistent data

## Reusing An Existing Container

If you already have a matching quickstart container running, you can attach to
it by name instead of starting a new one:

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  containerName: "colibri-stellar-test-ledger",
  useRunningLedger: true,
});

await ledger.start();
const details = await ledger.getNetworkDetails();
console.log(details.horizonUrl);
```

When `useRunningLedger` is enabled:

- `start()` fails if the named container does not exist, is not running, or uses
  a different image/configuration
- `stop()` and `destroy()` become no-ops so the harness does not shut down or
  delete a container it did not create

## API Summary

- `new StellarTestLedger(options)` creates a quickstart ledger manager
- `ledger.start(omitPull?)` starts or reuses the Docker container and waits
  until the requested services are ready
- `ledger.getNetworkDetails()` returns the plain service payload for the running
  ledger
- `ledger.getNetworkConfiguration()` is an alias of `getNetworkDetails()`
- `ledger.getContainer()` returns the Dockerode container instance
- `ledger.getContainerIpAddress()` returns the container IP reported by Docker
- `ledger.stop()` stops the tracked container without deleting it
- `ledger.destroy()` removes the tracked container with Docker's volume-removal
  option; it does not delete the host directory used for persistent bind storage
