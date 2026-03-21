import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { stub } from "@std/testing/mock";
import { EventEmitter } from "node:events";
import type { Container, ContainerInfo } from "dockerode";
import { StellarTestLedger } from "@/quickstart/index.ts";
import {
  Code,
  CONTAINER_ERROR,
  IMAGE_ERROR,
  INVALID_CONFIGURATION,
} from "@/quickstart/error.ts";
import { LogLevel } from "@/quickstart/logging.ts";
import {
  NetworkEnv,
  ResourceLimits,
  type SupportedImageVersions,
  type TestLedgerOptions,
} from "@/quickstart/types.ts";
import type {
  ContainerInspectInfo,
  DockerClientLike,
} from "@/quickstart/runtime.ts";

const createInspectInfo = (
  overrides: Partial<ContainerInspectInfo> = {},
): ContainerInspectInfo => {
  return {
    Id: "ledger-container",
    State: {
      Running: true,
      Status: "running",
      ExitCode: 0,
    },
    NetworkSettings: {
      Ports: {
        "8000/tcp": [{ HostPort: "18000", HostIp: "0.0.0.0" }],
      },
      Networks: {
        bridge: { IPAddress: "172.20.0.9" },
      },
    },
    Mounts: [],
    Config: { Env: [] },
    ...overrides,
  };
};

const createMockContainer = (
  inspectInfo: ContainerInspectInfo,
  options?: {
    id?: string;
    omitId?: boolean;
    logStream?: EventEmitter;
    stopError?: unknown;
    inspectError?: unknown;
  },
) => {
  const logStream = options?.logStream || new EventEmitter();
  const state = {
    startCalls: 0,
    stopCalls: 0,
    removeCalls: [] as Record<string, unknown>[],
  };

  const container = {
    id: options?.omitId ? undefined : options?.id || inspectInfo.Id,
    start: () => {
      state.startCalls += 1;
      return Promise.resolve();
    },
    stop: (
      _opts: Record<string, unknown>,
      callback: (error?: unknown) => void,
    ) => {
      state.stopCalls += 1;
      callback(options?.stopError);
    },
    remove: (removeOptions?: Record<string, unknown>) => {
      state.removeCalls.push(removeOptions || {});
      return Promise.resolve();
    },
    inspect: () => {
      if (options?.inspectError) {
        return Promise.reject(options.inspectError);
      }
      return Promise.resolve(inspectInfo);
    },
    logs: () => Promise.resolve(logStream),
  } as unknown as Container;

  return { container, state, logStream };
};

const HEALTHY_RPC_RESPONSE = JSON.stringify({
  jsonrpc: "2.0",
  id: 8675309,
  result: { status: "healthy" },
});

const createDockerHarness = (
  createdInspectInfo: ContainerInspectInfo = createInspectInfo(),
) => {
  const created = createMockContainer(createdInspectInfo);
  const containers = new Map<string, Container>([[
    created.container.id,
    created.container,
  ]]);
  const listContainers: ContainerInfo[] = [];
  const createCalls: Record<string, unknown>[] = [];
  const removedVolumes: string[] = [];
  let pullCalls = 0;

  const dockerClient: DockerClientLike & {
    createContainer: (options: Record<string, unknown>) => Promise<Container>;
  } = {
    listContainers: () => Promise.resolve(listContainers),
    getContainer: (id: string) => containers.get(id)!,
    getVolume: (name: string) => ({
      remove: () => {
        removedVolumes.push(name);
        return Promise.resolve();
      },
    }),
    createContainer: (options: Record<string, unknown>) => {
      createCalls.push(options);
      return Promise.resolve(created.container);
    },
    pull: (_image, _options, callback) => {
      pullCalls += 1;
      callback(
        undefined,
        new EventEmitter() as unknown as NodeJS.ReadableStream,
      );
    },
    modem: {
      followProgress: (_stream, onFinished) => onFinished(undefined, []),
    },
  };

  return {
    dockerClient,
    created,
    listContainers,
    containers,
    createCalls,
    removedVolumes,
    get pullCalls() {
      return pullCalls;
    },
    set pullFailure(error: unknown) {
      dockerClient.pull = (_image, _options, callback) => callback(error);
    },
  };
};

class TestLedger extends StellarTestLedger {
  constructor(
    options: TestLedgerOptions | undefined,
    private readonly dockerClient: DockerClientLike & {
      createContainer: (options: Record<string, unknown>) => Promise<Container>;
    },
  ) {
    super(options);
  }

  protected override getDockerClient() {
    return this.dockerClient as never;
  }
}

const withHealthyFetch = async (fn: () => Promise<void>) => {
  const fetchStub = stub(
    globalThis,
    "fetch",
    (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(HEALTHY_RPC_RESPONSE, { status: 200 }),
        );
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    },
  );

  try {
    await fn();
  } finally {
    fetchStub.restore();
  }
};

Deno.test("constructor validates supported options", () => {
  const networkError = assertThrows(
    () => new StellarTestLedger({ network: NetworkEnv.TESTNET as never }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(networkError.code, Code.INVALID_CONFIGURATION);

  const limitsError = assertThrows(
    () => new StellarTestLedger({ limits: ResourceLimits.DEFAULT as never }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(limitsError.code, Code.INVALID_CONFIGURATION);

  const imageError = assertThrows(
    () =>
      new StellarTestLedger({
        containerImageVersion: "bad-version" as SupportedImageVersions,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(imageError.code, Code.INVALID_CONFIGURATION);
});

Deno.test("constructor preserves numeric TRACE log levels", () => {
  const debugStub = stub(console, "debug", () => undefined);

  try {
    new StellarTestLedger({ logLevel: LogLevel.TRACE });

    assertEquals(debugStub.calls.length, 1);
    assertEquals(debugStub.calls[0].args[1], "Initialized");
  } finally {
    debugStub.restore();
  }
});

Deno.test("getContainer throws before the ledger starts", () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(undefined, harness.dockerClient);

  const error = assertThrows(() => ledger.getContainer(), CONTAINER_ERROR);
  assertStrictEquals(error.code, Code.CONTAINER_ERROR);
});

Deno.test("start creates a named container and exposes network information", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(
    { dockerOptions: { socketPath: "/var/run/docker.sock" } },
    harness.dockerClient,
  );

  await withHealthyFetch(async () => {
    const container = await ledger.start();

    assertStrictEquals(container, harness.created.container);
    assertEquals(harness.pullCalls, 1);
    assertEquals(harness.created.state.startCalls, 1);
    assertEquals(ledger.fullContainerImageName, "stellar/quickstart:latest");
    assertEquals(harness.createCalls[0].name, "colibri-stellar-test-ledger");
    assertEquals(harness.createCalls[0].Image, "stellar/quickstart:latest");
    assertEquals(harness.createCalls[0].Cmd, [
      "--local",
      "--limits",
      "testnet",
    ]);
    assertEquals(harness.createCalls[0].HostConfig, {
      PublishAllPorts: true,
    });

    const networkConfig = await ledger.getNetworkConfiguration();
    assertEquals(networkConfig.horizonUrl, "http://127.0.0.1:18000");
    assertEquals(networkConfig.rpcUrl, "http://127.0.0.1:18000/rpc");
    assertEquals(
      networkConfig.friendbotUrl,
      "http://127.0.0.1:18000/friendbot",
    );
    assertEquals(await ledger.getContainerIpAddress(), "172.20.0.9");
  });
});

Deno.test("start can skip pull and optionally stream logs", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(
    { emitContainerLogs: true, containerName: "custom-ledger" },
    harness.dockerClient,
  );

  await withHealthyFetch(async () => {
    await ledger.start(true);
  });

  assertEquals(harness.pullCalls, 0);
  assertEquals(harness.createCalls[0].name, "custom-ledger");
});

Deno.test("start reuses a running named container when useRunningLedger is enabled", async () => {
  const harness = createDockerHarness();
  const existing = createMockContainer(createInspectInfo(), {
    id: "running-container",
  });
  harness.containers.set(existing.container.id, existing.container);
  harness.listContainers.push({
    Id: "running-container",
    Image: "stellar/quickstart:latest",
    State: "running",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);

  const ledger = new TestLedger(
    { useRunningLedger: true },
    harness.dockerClient,
  );
  let fetchCalls = 0;
  const fetchStub = stub(
    globalThis,
    "fetch",
    (input: string | URL | Request) => {
      fetchCalls += 1;
      const url = String(input);
      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(HEALTHY_RPC_RESPONSE, { status: 200 }),
        );
      }

      return Promise.resolve(new Response("ok", { status: 200 }));
    },
  );

  try {
    const attached = await ledger.start();

    assertStrictEquals(attached, existing.container);
    assertEquals(harness.pullCalls, 0);
    assertEquals(harness.createCalls.length, 0);
    assertEquals(fetchCalls >= 2, true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("start can reuse a running named container without published ports", async () => {
  const harness = createDockerHarness();
  const existing = createMockContainer(
    createInspectInfo({
      NetworkSettings: {
        Ports: {},
        Networks: {
          bridge: { IPAddress: "172.20.0.9" },
        },
      },
    }),
    {
      id: "running-container-no-ports",
    },
  );
  harness.containers.set(existing.container.id, existing.container);
  harness.listContainers.push({
    Id: "running-container-no-ports",
    Image: "stellar/quickstart:latest",
    State: "running",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);

  const ledger = new TestLedger(
    { useRunningLedger: true },
    harness.dockerClient,
  );
  let fetchCalls = 0;
  const fetchStub = stub(globalThis, "fetch", () => {
    fetchCalls += 1;
    return Promise.resolve(new Response("ok", { status: 200 }));
  });

  try {
    const attached = await ledger.start();

    assertStrictEquals(attached, existing.container);
    assertEquals(fetchCalls, 0);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("start rejects when the running ledger cannot be reused safely", async () => {
  const missingHarness = createDockerHarness();
  const missingLedger = new TestLedger(
    { useRunningLedger: true },
    missingHarness.dockerClient,
  );
  const missingError = await assertRejects(
    () => missingLedger.start(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(missingError.code, Code.CONTAINER_ERROR);

  const wrongImageHarness = createDockerHarness();
  wrongImageHarness.listContainers.push({
    Id: "other",
    Image: "alpine:latest",
    State: "running",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);
  const wrongImageLedger = new TestLedger(
    { useRunningLedger: true },
    wrongImageHarness.dockerClient,
  );
  const wrongImageError = await assertRejects(
    () => wrongImageLedger.start(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(wrongImageError.code, Code.CONTAINER_ERROR);

  const stoppedHarness = createDockerHarness();
  stoppedHarness.listContainers.push({
    Id: "stopped",
    Image: "stellar/quickstart:latest",
    State: "exited",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);
  const stoppedLedger = new TestLedger(
    { useRunningLedger: true },
    stoppedHarness.dockerClient,
  );
  const stoppedError = await assertRejects(
    () => stoppedLedger.start(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(stoppedError.code, Code.CONTAINER_ERROR);
});

Deno.test("start removes stale named containers and existing tracked containers before recreating", async () => {
  const staleHarness = createDockerHarness();
  const staleInspect = createInspectInfo({
    Id: "stale-container",
    State: { Running: true, Status: "running", ExitCode: 0 },
    Mounts: [{ Type: "volume", Name: "stale-volume" }],
  });
  const stale = createMockContainer(staleInspect, { id: "stale-container" });
  staleHarness.containers.set("stale-container", stale.container);
  staleHarness.listContainers.push({
    Id: "stale-container",
    Image: "stellar/quickstart:latest",
    State: "running",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);

  const staleLedger = new TestLedger(undefined, staleHarness.dockerClient);
  await withHealthyFetch(async () => {
    await staleLedger.start();
  });
  assertEquals(stale.state.stopCalls, 1);
  assertEquals(stale.state.removeCalls.length, 1);
  assertEquals(staleHarness.removedVolumes, ["stale-volume"]);

  const trackedHarness = createDockerHarness();
  const trackedLedger = new TestLedger(undefined, trackedHarness.dockerClient);
  const previous = createMockContainer(createInspectInfo({ Id: "previous" }), {
    id: "previous",
  });
  trackedHarness.containers.set("previous", previous.container);
  trackedLedger.container = previous.container;
  trackedLedger.containerId = "previous";
  await withHealthyFetch(async () => {
    await trackedLedger.start();
  });
  assertEquals(previous.state.stopCalls, 1);
  assertEquals(previous.state.removeCalls, [{ v: true, force: true }]);
});

Deno.test("start removes a tracked container without an id using direct Docker cleanup", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(undefined, harness.dockerClient);
  const previous = createMockContainer(createInspectInfo({ Id: "ephemeral" }), {
    omitId: true,
  });

  ledger.container = previous.container;

  await withHealthyFetch(async () => {
    await ledger.start();
  });

  assertEquals(previous.state.stopCalls, 1);
  assertEquals(previous.state.removeCalls, [{ v: true, force: true }]);
});

Deno.test("getNetworkConfiguration uses the Docker daemon host for remote connections", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(
    { dockerOptions: { host: "docker.internal", port: 2375 } },
    harness.dockerClient,
  );

  ledger.container = harness.created.container;
  ledger.containerId = "ledger-container";

  const networkConfig = await ledger.getNetworkConfiguration();
  assertEquals(networkConfig.horizonUrl, "http://docker.internal:18000");
  assertEquals(networkConfig.rpcUrl, "http://docker.internal:18000/rpc");
  assertEquals(
    networkConfig.friendbotUrl,
    "http://docker.internal:18000/friendbot",
  );
});

Deno.test("start rejects on stale named container image mismatches and pull failures", async () => {
  const mismatchHarness = createDockerHarness();
  mismatchHarness.listContainers.push({
    Id: "mismatch",
    Image: "alpine:latest",
    State: "exited",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);
  const mismatchLedger = new TestLedger(
    undefined,
    mismatchHarness.dockerClient,
  );
  const mismatchError = await assertRejects(
    () => mismatchLedger.start(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(mismatchError.code, Code.CONTAINER_ERROR);

  const failedPullHarness = createDockerHarness();
  failedPullHarness.pullFailure = new Error("pull failed");
  const failedPullLedger = new TestLedger(
    { logLevel: "silent" },
    failedPullHarness.dockerClient,
  );
  const failedPullError = await assertRejects(
    () => failedPullLedger.start(),
    IMAGE_ERROR,
    "pull failed",
  );
  assertStrictEquals(failedPullError.code, Code.IMAGE_ERROR);
});

Deno.test("public APIs wrap unexpected underlying failures in quickstart errors", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(undefined, harness.dockerClient);

  harness.dockerClient.createContainer = () =>
    Promise.reject(new Error("cannot create"));

  const startError = await assertRejects(
    () => ledger.start(true),
    CONTAINER_ERROR,
    "Failed to start the Stellar test ledger.",
  );
  assertStrictEquals(startError.code, Code.CONTAINER_ERROR);

  const noNetworkLedger = new TestLedger(
    undefined,
    createDockerHarness(
      createInspectInfo({
        NetworkSettings: { Ports: {}, Networks: {} },
      }),
    ).dockerClient,
  );

  noNetworkLedger.container = createMockContainer(
    createInspectInfo({
      NetworkSettings: { Ports: {}, Networks: {} },
    }),
  ).container;
  noNetworkLedger.containerId = "ledger-container";

  const ipError = await assertRejects(
    () => noNetworkLedger.getContainerIpAddress(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(ipError.code, Code.CONTAINER_ERROR);

  const inspectFailureLedger = new TestLedger(undefined, harness.dockerClient);
  inspectFailureLedger.container = createMockContainer(createInspectInfo(), {
    inspectError: new Error("inspect failed"),
  }).container;
  inspectFailureLedger.containerId = "inspect-failure";

  const networkError = await assertRejects(
    () => inspectFailureLedger.getNetworkConfiguration(),
    CONTAINER_ERROR,
    "Failed to build network configuration for the test ledger.",
  );
  assertStrictEquals(networkError.code, Code.CONTAINER_ERROR);

  const stopFailureLedger = new TestLedger(undefined, harness.dockerClient);
  stopFailureLedger.container = createMockContainer(createInspectInfo(), {
    stopError: new Error("cannot stop"),
  }).container;
  stopFailureLedger.containerId = "stop-failure";

  const stopError = await assertRejects(
    () => stopFailureLedger.stop(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(stopError.code, Code.CONTAINER_ERROR);

  const destroyHarness = createDockerHarness();
  const brokenTracked = createMockContainer(
    createInspectInfo({ Id: "broken" }),
    {
      id: "broken",
      inspectError: new Error("cannot inspect"),
    },
  );
  destroyHarness.containers.set("broken", brokenTracked.container);
  const destroyFailureLedger = new TestLedger(
    undefined,
    destroyHarness.dockerClient,
  );
  destroyFailureLedger.containerId = "broken";

  const destroyError = await assertRejects(
    () => destroyFailureLedger.destroy(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(destroyError.code, Code.CONTAINER_ERROR);
});

Deno.test("stop and destroy are no-ops when there is nothing to do", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(undefined, harness.dockerClient);

  await ledger.stop();
  await ledger.destroy();

  const runningLedger = new TestLedger(
    { useRunningLedger: true },
    harness.dockerClient,
  );
  await runningLedger.stop();
  await runningLedger.destroy();
});

Deno.test("stop and destroy act on the tracked container", async () => {
  const inspectInfo = createInspectInfo({
    Id: "tracked",
    Mounts: [{ Type: "volume", Name: "tracked-volume" }],
  });
  const harness = createDockerHarness(inspectInfo);
  const tracked = createMockContainer(inspectInfo, { id: "tracked" });
  harness.containers.set("tracked", tracked.container);

  const ledger = new TestLedger(undefined, harness.dockerClient);
  ledger.container = tracked.container;
  ledger.containerId = "tracked";

  await ledger.stop();
  await ledger.destroy();

  assertEquals(tracked.state.stopCalls, 2);
  assertEquals(tracked.state.removeCalls, [{ v: true, force: true }]);
  assertEquals(harness.removedVolumes, ["tracked-volume"]);
  assertEquals(ledger.container, undefined);
  assertEquals(ledger.containerId, undefined);
});
