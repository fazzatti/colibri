import {
  assertEquals,
  assertNotStrictEquals,
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
  DEFAULT_ENABLED_SERVICES,
  NetworkEnv,
  QuickstartImageTags,
  type QuickstartService,
  QuickstartServices,
  QuickstartStorageModes,
  ResourceLimits,
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
    Config: {
      Env: [],
      Cmd: [
        "--local",
        "--limits",
        "testnet",
        "--enable",
        DEFAULT_ENABLED_SERVICES.join(","),
      ],
    },
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

class TestLedger<
  const Network extends NetworkEnv = NetworkEnv.LOCAL,
  const Services extends readonly QuickstartService[] =
    typeof DEFAULT_ENABLED_SERVICES,
> extends StellarTestLedger<Network, Services> {
  constructor(
    options: TestLedgerOptions<Network, Services> | undefined,
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
    () => new StellarTestLedger({ network: "pubnet" as never }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(networkError.code, Code.INVALID_CONFIGURATION);

  const limitsError = assertThrows(
    () =>
      new StellarTestLedger({
        network: NetworkEnv.TESTNET,
        limits: ResourceLimits.DEFAULT,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(limitsError.code, Code.INVALID_CONFIGURATION);

  const emptyImageError = assertThrows(
    () =>
      new StellarTestLedger({
        containerImageVersion: "",
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(emptyImageError.code, Code.INVALID_CONFIGURATION);

  const legacyImageError = assertThrows(
    () =>
      new StellarTestLedger({
        ...({
          customContainerImageVersion: "legacy-tag",
        } as Record<string, unknown>),
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(legacyImageError.code, Code.INVALID_CONFIGURATION);

  const nonStringImageError = assertThrows(
    () =>
      new StellarTestLedger({
        containerImageVersion: 42 as unknown as string,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(nonStringImageError.code, Code.INVALID_CONFIGURATION);

  const emptyServicesError = assertThrows(
    () =>
      new StellarTestLedger({
        enabledServices: [],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(emptyServicesError.code, Code.INVALID_CONFIGURATION);

  const coreOnlyServicesError = assertThrows(
    () =>
      new StellarTestLedger({
        enabledServices: [QuickstartServices.CORE] as const,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(
    coreOnlyServicesError.code,
    Code.INVALID_CONFIGURATION,
  );

  const nonLocalGalexieError = assertThrows(
    () =>
      new StellarTestLedger({
        network: NetworkEnv.TESTNET,
        enabledServices: [
          QuickstartServices.RPC,
          QuickstartServices.GALEXIE,
        ] as const,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(nonLocalGalexieError.code, Code.INVALID_CONFIGURATION);

  const galexieWithoutRpcError = assertThrows(
    () =>
      new StellarTestLedger({
        enabledServices: [
          QuickstartServices.CORE,
          QuickstartServices.GALEXIE,
        ] as const,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(galexieWithoutRpcError.code, Code.INVALID_CONFIGURATION);

  const storagePathError = assertThrows(
    () =>
      new StellarTestLedger({
        storage: {
          mode: QuickstartStorageModes.PERSISTENT,
          hostPath: "relative/path",
        },
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(storagePathError.code, Code.INVALID_CONFIGURATION);
});

Deno.test("constructor validates remaining service and storage edge cases", () => {
  const invalidLocalLimitsError = assertThrows(
    () =>
      new StellarTestLedger({
        limits: "impossible" as ResourceLimits,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(
    invalidLocalLimitsError.code,
    Code.INVALID_CONFIGURATION,
  );

  const nonArrayServicesError = assertThrows(
    () =>
      new StellarTestLedger({
        enabledServices: "rpc" as unknown as readonly QuickstartService[],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(
    nonArrayServicesError.code,
    Code.INVALID_CONFIGURATION,
  );

  const nonStringServiceError = assertThrows(
    () =>
      new StellarTestLedger({
        enabledServices: [42 as unknown as QuickstartService],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(nonStringServiceError.code, Code.INVALID_CONFIGURATION);

  const unsupportedServiceError = assertThrows(
    () =>
      new StellarTestLedger({
        enabledServices: ["hubble" as QuickstartService],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(unsupportedServiceError.code, Code.INVALID_CONFIGURATION);

  const nonObjectStorageError = assertThrows(
    () =>
      new StellarTestLedger({
        storage: "persistent" as unknown as TestLedgerOptions["storage"],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(nonObjectStorageError.code, Code.INVALID_CONFIGURATION);

  const unsupportedStorageModeError = assertThrows(
    () =>
      new StellarTestLedger({
        storage: {
          mode: "sidecar",
        } as unknown as TestLedgerOptions["storage"],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(
    unsupportedStorageModeError.code,
    Code.INVALID_CONFIGURATION,
  );

  const ephemeralHostPathError = assertThrows(
    () =>
      new StellarTestLedger({
        storage: {
          mode: QuickstartStorageModes.EPHEMERAL,
          hostPath: "/tmp/should-not-exist",
        } as unknown as TestLedgerOptions["storage"],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(ephemeralHostPathError.code, Code.INVALID_CONFIGURATION);

  const nonStringPersistentHostPathError = assertThrows(
    () =>
      new StellarTestLedger({
        storage: {
          mode: QuickstartStorageModes.PERSISTENT,
          hostPath: 42,
        } as unknown as TestLedgerOptions["storage"],
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(
    nonStringPersistentHostPathError.code,
    Code.INVALID_CONFIGURATION,
  );

  const emptyPersistentHostPathError = assertThrows(
    () =>
      new StellarTestLedger({
        storage: {
          mode: QuickstartStorageModes.PERSISTENT,
          hostPath: "   ",
        },
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(
    emptyPersistentHostPathError.code,
    Code.INVALID_CONFIGURATION,
  );

  const ephemeralLedger = new StellarTestLedger({
    storage: { mode: QuickstartStorageModes.EPHEMERAL },
  });
  assertEquals(ephemeralLedger.storage, {
    mode: QuickstartStorageModes.EPHEMERAL,
  });

  const implicitEphemeralLedger = new StellarTestLedger({
    storage: {} as TestLedgerOptions["storage"],
  });
  assertEquals(implicitEphemeralLedger.storage, {
    mode: QuickstartStorageModes.EPHEMERAL,
  });
});

Deno.test("constructor normalizes empty container identifiers and returns fresh storage defaults", () => {
  const ledger = new StellarTestLedger({
    containerName: "   ",
    containerImageName: "",
  });
  assertEquals(ledger.containerName, "colibri-stellar-test-ledger");
  assertEquals(ledger.containerImageName, "stellar/quickstart");

  const first = new StellarTestLedger();
  const second = new StellarTestLedger();

  assertNotStrictEquals(first.storage, second.storage);
  assertEquals(first.storage, { mode: QuickstartStorageModes.EPHEMERAL });
  assertEquals(second.storage, { mode: QuickstartStorageModes.EPHEMERAL });
});

Deno.test("constructor rejects non-string container identifiers", () => {
  const nameError = assertThrows(
    () =>
      new StellarTestLedger({
        containerName: 42 as unknown as string,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(nameError.code, Code.INVALID_CONFIGURATION);

  const imageNameError = assertThrows(
    () =>
      new StellarTestLedger({
        containerImageName: 42 as unknown as string,
      }),
    INVALID_CONFIGURATION,
  );
  assertStrictEquals(imageNameError.code, Code.INVALID_CONFIGURATION);
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

Deno.test("constructor reuses the same Docker client instance", () => {
  class ExposedLedger extends StellarTestLedger {
    public exposeDockerClient() {
      return this.getDockerClient();
    }
  }

  const ledger = new ExposedLedger({
    dockerOptions: { socketPath: "/var/run/docker.sock" },
  });

  assertStrictEquals(ledger.exposeDockerClient(), ledger.exposeDockerClient());
});

Deno.test("constructor accepts arbitrary image tags through containerImageVersion", () => {
  const ledger = new StellarTestLedger({
    containerImageName: "stellar/quickstart",
    containerImageVersion: "v999-custom",
  });

  assertEquals(ledger.containerImageVersion, "v999-custom");
  assertEquals(ledger.fullContainerImageName, "stellar/quickstart:v999-custom");
});

Deno.test("constructor accepts non-local networks and persistent storage", () => {
  const futureLedger = new StellarTestLedger({
    network: NetworkEnv.FUTURENET,
    enabledServices: [QuickstartServices.LAB] as const,
  });
  assertEquals(futureLedger.network, NetworkEnv.FUTURENET);
  assertEquals(futureLedger.limits, undefined);

  const persistentLedger = new StellarTestLedger({
    storage: {
      mode: QuickstartStorageModes.PERSISTENT,
      hostPath: "/tmp/colibri-quickstart-persistent",
    },
  });
  assertEquals(persistentLedger.storage, {
    mode: QuickstartStorageModes.PERSISTENT,
    hostPath: "/tmp/colibri-quickstart-persistent",
  });
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
      "--enable",
      DEFAULT_ENABLED_SERVICES.join(","),
    ]);
    assertEquals(harness.createCalls[0].HostConfig, {
      PublishAllPorts: true,
    });

    const networkDetails = await ledger.getNetworkDetails();
    assertEquals(networkDetails.horizonUrl, "http://127.0.0.1:18000");
    assertEquals(networkDetails.rpcUrl, "http://127.0.0.1:18000/rpc");
    assertEquals(
      networkDetails.friendbotUrl,
      "http://127.0.0.1:18000/friendbot",
    );
    assertEquals(await ledger.getContainerIpAddress(), "172.20.0.9");
  });
});

Deno.test("start uses the selected network, services, and storage mode", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(
    {
      network: NetworkEnv.TESTNET,
      containerImageVersion: QuickstartImageTags.TESTING,
      enabledServices: [QuickstartServices.LAB] as const,
      storage: {
        mode: QuickstartStorageModes.PERSISTENT,
        hostPath: "/tmp/colibri-ledger-data",
      },
    },
    harness.dockerClient,
  );

  const fetchStub = stub(globalThis, "fetch", () => {
    return Promise.resolve(new Response("ok", { status: 200 }));
  });

  try {
    await ledger.start(true);
  } finally {
    fetchStub.restore();
  }

  assertEquals(harness.createCalls[0].Image, "stellar/quickstart:testing");
  assertEquals(harness.createCalls[0].Cmd, [
    "--testnet",
    "--enable",
    QuickstartServices.LAB,
  ]);
  assertEquals(harness.createCalls[0].HostConfig, {
    PublishAllPorts: true,
    Binds: ["/tmp/colibri-ledger-data:/opt/stellar"],
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

  const mismatchedConfigHarness = createDockerHarness();
  const mismatchedInspect = createInspectInfo({
    Config: {
      Env: [],
      Cmd: [
        "--testnet",
        "--enable",
        DEFAULT_ENABLED_SERVICES.join(","),
      ],
    },
  });
  const mismatchedConfig = createMockContainer(mismatchedInspect, {
    id: "running-mismatched-config",
  });
  mismatchedConfigHarness.containers.set(
    mismatchedConfig.container.id,
    mismatchedConfig.container,
  );
  mismatchedConfigHarness.listContainers.push({
    Id: "running-mismatched-config",
    Image: "stellar/quickstart:latest",
    State: "running",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);
  const mismatchedConfigLedger = new TestLedger(
    { useRunningLedger: true },
    mismatchedConfigHarness.dockerClient,
  );
  const mismatchedConfigError = await assertRejects(
    () => mismatchedConfigLedger.start(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(mismatchedConfigError.code, Code.CONTAINER_ERROR);

  const missingConfigHarness = createDockerHarness();
  const missingConfigInspect = createInspectInfo({
    Config: { Env: [] },
  });
  const missingConfig = createMockContainer(missingConfigInspect, {
    id: "running-missing-config",
  });
  missingConfigHarness.containers.set(
    missingConfig.container.id,
    missingConfig.container,
  );
  missingConfigHarness.listContainers.push({
    Id: "running-missing-config",
    Image: "stellar/quickstart:latest",
    State: "running",
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo);
  const missingConfigLedger = new TestLedger(
    { useRunningLedger: true },
    missingConfigHarness.dockerClient,
  );
  const missingConfigError = await assertRejects(
    () => missingConfigLedger.start(),
    CONTAINER_ERROR,
  );
  assertStrictEquals(missingConfigError.code, Code.CONTAINER_ERROR);
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

Deno.test("getNetworkDetails uses the Docker daemon host for remote connections", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(
    { dockerOptions: { host: "docker.internal", port: 2375 } },
    harness.dockerClient,
  );

  ledger.container = harness.created.container;
  ledger.containerId = "ledger-container";

  const networkDetails = await ledger.getNetworkDetails();
  assertEquals(networkDetails.horizonUrl, "http://docker.internal:18000");
  assertEquals(networkDetails.rpcUrl, "http://docker.internal:18000/rpc");
  assertEquals(
    networkDetails.friendbotUrl,
    "http://docker.internal:18000/friendbot",
  );
});

Deno.test("getNetworkConfiguration delegates to getNetworkDetails", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(undefined, harness.dockerClient);

  ledger.container = harness.created.container;
  ledger.containerId = "ledger-container";

  assertEquals(await ledger.getNetworkConfiguration(), {
    networkPassphrase: "Standalone Network ; February 2017",
    rpcUrl: "http://127.0.0.1:18000/rpc",
    horizonUrl: "http://127.0.0.1:18000",
    friendbotUrl: "http://127.0.0.1:18000/friendbot",
    allowHttp: true,
  });
});

Deno.test("getNetworkDetails follows the selected network and service tuple", async () => {
  const harness = createDockerHarness();
  const localLedger = new TestLedger(
    {
      enabledServices: [
        QuickstartServices.RPC,
        QuickstartServices.GALEXIE,
      ] as const,
    },
    harness.dockerClient,
  );
  localLedger.container = harness.created.container;
  localLedger.containerId = "ledger-container";

  assertEquals(await localLedger.getNetworkDetails(), {
    networkPassphrase: "Standalone Network ; February 2017",
    rpcUrl: "http://127.0.0.1:18000/rpc",
    horizonUrl: "http://127.0.0.1:18000",
    friendbotUrl: "http://127.0.0.1:18000/friendbot",
    ledgerMetaUrl: "http://127.0.0.1:18000/ledger-meta",
    allowHttp: true,
  });

  const futureLedger = new TestLedger(
    {
      network: NetworkEnv.FUTURENET,
      enabledServices: [QuickstartServices.LAB] as const,
    },
    harness.dockerClient,
  );
  futureLedger.container = harness.created.container;
  futureLedger.containerId = "ledger-container";

  assertEquals(await futureLedger.getNetworkDetails(), {
    networkPassphrase: "Test SDF Future Network ; October 2022",
    friendbotUrl: "http://127.0.0.1:18000/friendbot",
    labUrl: "http://127.0.0.1:18000/lab",
    transactionsExplorerUrl: "http://127.0.0.1:18000/lab/transactions-explorer",
    allowHttp: true,
  });
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

Deno.test("start cleans up a newly created container when startup readiness fails", async () => {
  const inspectInfo = createInspectInfo({
    Id: "startup-failure",
    Mounts: [{ Type: "volume", Name: "startup-failure-volume" }],
  });
  const harness = createDockerHarness(inspectInfo);
  class FailingStartLedger extends TestLedger {
    protected override waitUntilReady() {
      return Promise.reject(new Error("not ready"));
    }
  }

  const ledger = new FailingStartLedger(undefined, harness.dockerClient);

  const startError = await assertRejects(
    () => ledger.start(true),
    CONTAINER_ERROR,
    "Failed to start the Stellar test ledger.",
  );

  assertStrictEquals(startError.code, Code.CONTAINER_ERROR);
  assertEquals(harness.created.state.startCalls, 1);
  assertEquals(harness.created.state.stopCalls, 1);
  assertEquals(harness.created.state.removeCalls, [{ v: true, force: true }]);
  assertEquals(harness.removedVolumes, ["startup-failure-volume"]);
  assertEquals(ledger.container, undefined);
  assertEquals(ledger.containerId, undefined);
});

Deno.test("start cleans up a newly created container without an id when startup fails", async () => {
  const harness = createDockerHarness();
  const created = createMockContainer(createInspectInfo({ Id: "ephemeral" }), {
    omitId: true,
  });
  harness.dockerClient.createContainer = () =>
    Promise.resolve(created.container);
  class FailingStartLedger extends TestLedger {
    protected override waitUntilReady() {
      return Promise.reject(new Error("not ready"));
    }
  }
  const ledger = new FailingStartLedger(undefined, harness.dockerClient);

  const startError = await assertRejects(
    () => ledger.start(true),
    CONTAINER_ERROR,
    "Failed to start the Stellar test ledger.",
  );

  assertStrictEquals(startError.code, Code.CONTAINER_ERROR);
  assertEquals(created.state.startCalls, 1);
  assertEquals(created.state.removeCalls, [{ v: true, force: true }]);
  assertEquals(ledger.container, undefined);
  assertEquals(ledger.containerId, undefined);
});

Deno.test("start preserves the startup error when cleanup also fails", async () => {
  const harness = createDockerHarness();
  const created = createMockContainer(
    createInspectInfo({ Id: "cleanup-broken" }),
    {
      id: "cleanup-broken",
      inspectError: new Error("cannot inspect cleanup"),
    },
  );
  harness.containers.set("cleanup-broken", created.container);
  harness.dockerClient.createContainer = () =>
    Promise.resolve(created.container);

  class FailingStartLedger extends TestLedger {
    protected override waitUntilReady() {
      return Promise.reject(new Error("not ready"));
    }
  }

  const ledger = new FailingStartLedger(undefined, harness.dockerClient);

  const startError = await assertRejects(
    () => ledger.start(true),
    CONTAINER_ERROR,
    "Failed to start the Stellar test ledger.",
  );

  assertStrictEquals(startError.code, Code.CONTAINER_ERROR);
  assertEquals(ledger.container, undefined);
  assertEquals(ledger.containerId, undefined);
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
    () => inspectFailureLedger.getNetworkDetails(),
    CONTAINER_ERROR,
    "Failed to build network details for the test ledger.",
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

Deno.test("destroy removes a tracked container without an id", async () => {
  const harness = createDockerHarness();
  const ledger = new TestLedger(undefined, harness.dockerClient);
  const tracked = createMockContainer(createInspectInfo({ Id: "ephemeral" }), {
    omitId: true,
  });

  ledger.container = tracked.container;

  await ledger.destroy();

  assertEquals(tracked.state.removeCalls, [{ v: true, force: true }]);
  assertEquals(ledger.container, undefined);
  assertEquals(ledger.containerId, undefined);
});
