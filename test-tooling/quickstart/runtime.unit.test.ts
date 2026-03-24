import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { stub } from "@std/testing/mock";
import { EventEmitter } from "node:events";
import type { Container, ContainerInfo } from "dockerode";
import {
  Code,
  CONTAINER_ERROR,
  IMAGE_ERROR,
  READINESS_ERROR,
} from "@/quickstart/error.ts";
import {
  type ContainerInspectInfo,
  type DockerClientLike,
  findContainerByName,
  getContainerIpAddress,
  getPublicPort,
  hasContainerName,
  pullImage,
  pullImageOnce,
  removeContainerAndVolumes,
  stopContainer,
  streamContainerLogs,
  waitForLedgerReady,
} from "@/quickstart/runtime.ts";

type PullCallback = (
  error: unknown,
  stream?: NodeJS.ReadableStream,
) => void;
type FollowProgressCallback = (error: unknown, output: unknown[]) => void;
type FollowProgressEvent = { progress?: string; status?: string };

const createDockerLogFrame = (message: string, streamType = 1): Uint8Array => {
  const payload = new TextEncoder().encode(message);
  const frame = new Uint8Array(8 + payload.length);

  frame[0] = streamType;
  frame[4] = (payload.length >>> 24) & 0xff;
  frame[5] = (payload.length >>> 16) & 0xff;
  frame[6] = (payload.length >>> 8) & 0xff;
  frame[7] = payload.length & 0xff;
  frame.set(payload, 8);

  return frame;
};

const createRpcHealthResponse = (status: string): string =>
  JSON.stringify({
    jsonrpc: "2.0",
    id: 8675309,
    result: { status },
  });

const createLoggerSpy = () => {
  const messages = {
    debug: [] as unknown[][],
    info: [] as unknown[][],
    warn: [] as unknown[][],
    error: [] as unknown[][],
    trace: [] as unknown[][],
  };

  return {
    logger: {
      debug: (...args: unknown[]) => messages.debug.push(args),
      info: (...args: unknown[]) => messages.info.push(args),
      warn: (...args: unknown[]) => messages.warn.push(args),
      error: (...args: unknown[]) => messages.error.push(args),
      trace: (...args: unknown[]) => messages.trace.push(args),
    },
    messages,
  };
};

const createInspectInfo = (
  overrides: Partial<ContainerInspectInfo> = {},
): ContainerInspectInfo => {
  return {
    Id: "container-id",
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
        bridge: { IPAddress: "172.20.0.2" },
      },
    },
    Mounts: [],
    Config: { Env: ["A=B"] },
    ...overrides,
  };
};

const createFakeContainer = (
  inspectInfo: ContainerInspectInfo,
  options?: {
    id?: string;
    stopError?: unknown;
    logStream?: EventEmitter;
    onRemove?: (options: Record<string, unknown>) => void;
  },
): Container => {
  const id = options?.id || inspectInfo.Id;
  const logStream = options?.logStream || new EventEmitter();

  return {
    id,
    inspect: () => Promise.resolve(inspectInfo),
    remove: (removeOptions?: Record<string, unknown>) => {
      options?.onRemove?.(removeOptions || {});
      return Promise.resolve();
    },
    stop: (
      _opts: Record<string, unknown>,
      callback: (error?: unknown) => void,
    ) => callback(options?.stopError),
    logs: () => Promise.resolve(logStream),
  } as unknown as Container;
};

Deno.test("hasContainerName and findContainerByName match Docker names", async () => {
  const target = {
    Names: ["/colibri-stellar-test-ledger"],
  } as ContainerInfo;
  const dockerClient = {
    listContainers: () => Promise.resolve([target]),
  } as unknown as DockerClientLike;

  assertEquals(hasContainerName(target, "colibri-stellar-test-ledger"), true);
  assertEquals(hasContainerName(target, "other"), false);
  assertEquals(hasContainerName({} as ContainerInfo, "missing"), false);
  assertEquals(
    await findContainerByName("colibri-stellar-test-ledger", { dockerClient }),
    target,
  );
  assertEquals(
    await findContainerByName("missing", { dockerClient }),
    undefined,
  );

  const wrappedError = await assertRejects(
    () =>
      findContainerByName("broken", {
        dockerClient: {
          listContainers: () =>
            Promise.reject(
              new CONTAINER_ERROR({
                message: "already wrapped",
                details: "wrapped",
              }),
            ),
        } as unknown as DockerClientLike,
      }),
    CONTAINER_ERROR,
    "already wrapped",
  );
  assertStrictEquals(wrappedError.code, Code.CONTAINER_ERROR);
});

Deno.test("stopContainer resolves and rejects based on the Docker callback", async () => {
  await stopContainer(createFakeContainer(createInspectInfo()));

  const error = await assertRejects(
    () =>
      stopContainer(
        createFakeContainer(createInspectInfo(), {
          stopError: new Error("failed"),
        }),
      ),
    CONTAINER_ERROR,
    "failed",
  );
  assertStrictEquals(error.code, Code.CONTAINER_ERROR);
});

Deno.test("removeContainerAndVolumes stops running containers and removes only volumes", async () => {
  const inspectInfo = createInspectInfo({
    Mounts: [
      { Type: "volume", Name: "keep-me" },
      { Type: "bind", Name: "bind-mount" },
      { Type: "volume", Name: "broken-volume" },
    ],
  });
  const removedVolumes: string[] = [];
  const removeOptions: Record<string, unknown>[] = [];
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(inspectInfo, {
    onRemove: (options) => removeOptions.push(options),
  });
  const dockerClient = {
    getContainer: () => container,
    getVolume: (name: string) => ({
      remove: () => {
        if (name === "broken-volume") {
          return Promise.reject(new Error("broken"));
        }
        removedVolumes.push(name);
        return Promise.resolve();
      },
    }),
  } as unknown as DockerClientLike;

  await removeContainerAndVolumes("container-id", {
    dockerClient,
    logger,
  });

  assertEquals(removeOptions, [{ v: true, force: true }]);
  assertEquals(removedVolumes, ["keep-me"]);
  assertEquals(messages.debug.length, 1);
});

Deno.test("removeContainerAndVolumes handles stopped containers with no mounts", async () => {
  const removeOptions: Record<string, unknown>[] = [];
  const inspectInfo = createInspectInfo({
    State: {
      Running: false,
      Status: "exited",
      ExitCode: 0,
    },
    Mounts: [],
  });
  const container = createFakeContainer(inspectInfo, {
    onRemove: (options) => removeOptions.push(options),
  });
  const dockerClient = {
    getContainer: () => container,
    getVolume: () => ({
      remove: () => Promise.resolve(undefined),
    }),
  } as unknown as DockerClientLike;

  await removeContainerAndVolumes("container-id", { dockerClient });

  assertEquals(removeOptions, [{ v: true, force: true }]);
});

Deno.test("removeContainerAndVolumes wraps unexpected failures", async () => {
  const dockerClient = {
    getContainer: () => ({
      inspect: () => Promise.reject(new Error("inspect failed")),
    }),
  } as unknown as DockerClientLike;

  const error = await assertRejects(
    () => removeContainerAndVolumes("container-id", { dockerClient }),
    CONTAINER_ERROR,
    "Failed to remove Docker container.",
  );
  assertStrictEquals(error.code, Code.CONTAINER_ERROR);
});

Deno.test("getPublicPort validates mappings", () => {
  assertEquals(getPublicPort(8000, createInspectInfo()), 18000);

  const missingMappingError = assertThrows(
    () =>
      getPublicPort(
        8000,
        createInspectInfo({
          NetworkSettings: { Ports: {}, Networks: {} },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(missingMappingError.code, Code.CONTAINER_ERROR);

  const missingPortsError = assertThrows(
    () =>
      getPublicPort(
        8000,
        createInspectInfo({
          NetworkSettings: {
            Networks: {},
          },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(missingPortsError.code, Code.CONTAINER_ERROR);

  const invalidPortError = assertThrows(
    () =>
      getPublicPort(
        8000,
        createInspectInfo({
          NetworkSettings: {
            Ports: {
              "8000/tcp": [{ HostPort: "not-a-number" }],
            },
            Networks: {},
          },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(invalidPortError.code, Code.CONTAINER_ERROR);

  const zeroPortError = assertThrows(
    () =>
      getPublicPort(
        8000,
        createInspectInfo({
          NetworkSettings: {
            Ports: {
              "8000/tcp": [{ HostPort: "0" }],
            },
            Networks: {},
          },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(zeroPortError.code, Code.CONTAINER_ERROR);

  const outOfRangePortError = assertThrows(
    () =>
      getPublicPort(
        8000,
        createInspectInfo({
          NetworkSettings: {
            Ports: {
              "8000/tcp": [{ HostPort: "70000" }],
            },
            Networks: {},
          },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(outOfRangePortError.code, Code.CONTAINER_ERROR);
});

Deno.test("getContainerIpAddress returns the first network IP and validates missing networks", () => {
  assertEquals(getContainerIpAddress(createInspectInfo()), "172.20.0.2");

  const emptyNetworksError = assertThrows(
    () =>
      getContainerIpAddress(
        createInspectInfo({
          NetworkSettings: {
            Ports: {},
            Networks: {},
          },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(emptyNetworksError.code, Code.CONTAINER_ERROR);

  const undefinedNetworksError = assertThrows(
    () =>
      getContainerIpAddress(
        createInspectInfo({
          NetworkSettings: {
            Ports: {},
          },
        }),
      ),
    CONTAINER_ERROR,
  );
  assertStrictEquals(undefinedNetworksError.code, Code.CONTAINER_ERROR);
});

Deno.test("pullImageOnce handles pull errors, missing streams, and success", async () => {
  const { logger, messages } = createLoggerSpy();

  const pullError = await assertRejects(
    () =>
      pullImageOnce("stellar/quickstart:latest", {
        dockerClient: {
          pull: (
            _image: string,
            _options: Record<string, unknown>,
            callback: PullCallback,
          ) => callback(new Error("no pull")),
          modem: { followProgress: () => undefined },
        } as unknown as DockerClientLike,
        logger,
      }),
    IMAGE_ERROR,
    "no pull",
  );
  assertStrictEquals(pullError.code, Code.IMAGE_ERROR);

  const noStreamError = await assertRejects(
    () =>
      pullImageOnce("stellar/quickstart:latest", {
        dockerClient: {
          pull: (
            _image: string,
            _options: Record<string, unknown>,
            callback: PullCallback,
          ) => callback(undefined, undefined),
          modem: { followProgress: () => undefined },
        } as unknown as DockerClientLike,
        logger,
      }),
    IMAGE_ERROR,
  );
  assertStrictEquals(noStreamError.code, Code.IMAGE_ERROR);

  const result = await pullImageOnce("stellar/quickstart:latest", {
    dockerClient: {
      pull: (
        _image: string,
        _options: Record<string, unknown>,
        callback: PullCallback,
      ) =>
        callback(
          undefined,
          new EventEmitter() as unknown as NodeJS.ReadableStream,
        ),
      modem: {
        followProgress: (
          _stream: NodeJS.ReadableStream,
          onFinished: FollowProgressCallback,
          onProgress?: (event: FollowProgressEvent) => void,
        ) => {
          onProgress?.({ status: "Downloading" });
          onFinished(undefined, ["done"]);
        },
      },
    } as unknown as DockerClientLike,
    logger,
  });

  assertEquals(result, ["done"]);
  assertEquals(messages.debug.length > 0, true);
});

Deno.test("pullImageOnce surfaces progress errors and throttles progress logs", async () => {
  const { logger, messages } = createLoggerSpy();

  const progressError = await assertRejects(
    () =>
      pullImageOnce("stellar/quickstart:latest", {
        dockerClient: {
          pull: (
            _image: string,
            _options: Record<string, unknown>,
            callback: PullCallback,
          ) =>
            callback(
              undefined,
              new EventEmitter() as unknown as NodeJS.ReadableStream,
            ),
          modem: {
            followProgress: (
              _stream: NodeJS.ReadableStream,
              onFinished: FollowProgressCallback,
            ) => onFinished(new Error("progress failed"), []),
          },
        } as unknown as DockerClientLike,
        logger,
      }),
    IMAGE_ERROR,
    "progress failed",
  );
  assertStrictEquals(progressError.code, Code.IMAGE_ERROR);

  const nowValues = [1001, 1500, 2501];
  const dateNowStub = stub(Date, "now", () => nowValues.shift() ?? 2501);

  try {
    const result = await pullImageOnce("stellar/quickstart:latest", {
      dockerClient: {
        pull: (
          _image: string,
          _options: Record<string, unknown>,
          callback: PullCallback,
        ) =>
          callback(
            undefined,
            new EventEmitter() as unknown as NodeJS.ReadableStream,
          ),
        modem: {
          followProgress: (
            _stream: NodeJS.ReadableStream,
            onFinished: FollowProgressCallback,
            onProgress?: (event: FollowProgressEvent) => void,
          ) => {
            onProgress?.({ status: "Downloading" });
            onProgress?.({ status: "Ignored" });
            onProgress?.({});
            onFinished(undefined, ["ok"]);
          },
        },
      } as unknown as DockerClientLike,
      logger,
    });

    assertEquals(result, ["ok"]);
    assertEquals(messages.debug, [
      ['"Downloading"'],
      ['"pulling image"'],
      ["Finished stellar/quickstart:latest pull completely OK"],
    ]);
  } finally {
    dateNowStub.restore();
  }
});

Deno.test("pullImage retries and eventually succeeds or fails", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const { logger, messages } = createLoggerSpy();

  const result = await pullImage("stellar/quickstart:latest", {
    retries: 2,
    sleepFn: (delay) => {
      delays.push(delay);
      return Promise.resolve();
    },
    dockerClient: {
      pull: (
        _image: string,
        _options: Record<string, unknown>,
        callback: PullCallback,
      ) => {
        attempts += 1;
        if (attempts < 2) {
          callback(new Error("transient"));
        } else {
          callback(
            undefined,
            new EventEmitter() as unknown as NodeJS.ReadableStream,
          );
        }
      },
      modem: {
        followProgress: (
          _stream: NodeJS.ReadableStream,
          onFinished: FollowProgressCallback,
        ) => onFinished(undefined, ["ok"]),
      },
    } as unknown as DockerClientLike,
    logger,
  });

  assertEquals(result, ["ok"]);
  assertEquals(delays, [1000]);
  assertEquals(messages.warn.length, 1);

  const fatalError = await assertRejects(
    () =>
      pullImage("stellar/quickstart:latest", {
        retries: 0,
        dockerClient: {
          pull: (
            _image: string,
            _options: Record<string, unknown>,
            callback: PullCallback,
          ) => callback(new Error("fatal")),
          modem: { followProgress: () => undefined },
        } as unknown as DockerClientLike,
      }),
    IMAGE_ERROR,
    "fatal",
  );
  assertStrictEquals(fatalError.code, Code.IMAGE_ERROR);

  const zeroRetryClient = {
    pull: (
      _image: string,
      _options: Record<string, unknown>,
      callback: PullCallback,
    ) =>
      callback(
        undefined,
        new EventEmitter() as unknown as NodeJS.ReadableStream,
      ),
    modem: {
      followProgress: (
        _stream: NodeJS.ReadableStream,
        onFinished: FollowProgressCallback,
      ) => onFinished(undefined, ["one-shot"]),
    },
  } as unknown as DockerClientLike;

  assertEquals(
    await pullImage("stellar/quickstart:latest", {
      retries: -1,
      dockerClient: zeroRetryClient,
    }),
    ["one-shot"],
  );
});

Deno.test("streamContainerLogs demultiplexes docker frames and accepts strings", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", "\r\n");
  stream.emit("data", createDockerLogFrame("hello"));
  stream.emit("data", "world");
  stream.emit("end");

  assertEquals(messages.debug, [["[ledger] hello"], ["[ledger] world"]]);
});

Deno.test("streamContainerLogs flushes partial plain binary chunks on end", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", new TextEncoder().encode("plain"));
  stream.emit("end");

  assertEquals(messages.debug, [["[ledger] plain"]]);
});

Deno.test("streamContainerLogs falls back when binary chunks are not docker frames", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", new TextEncoder().encode("plain-binary"));

  assertEquals(messages.debug, [["[ledger] plain-binary"]]);
});

Deno.test("streamContainerLogs buffers partial docker frames until the payload completes", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });
  const frame = createDockerLogFrame("split-frame");

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", frame.subarray(0, 10));
  assertEquals(messages.debug, []);

  stream.emit("data", frame.subarray(10));
  assertEquals(messages.debug, [["[ledger] split-frame"]]);
});

Deno.test("streamContainerLogs compacts buffered partial frames before appending more data", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });
  const firstMessage = "a".repeat(4000);
  const secondMessage = "b".repeat(4500);
  const firstFrame = createDockerLogFrame(firstMessage);
  const secondFrame = createDockerLogFrame(secondMessage);
  const secondFrameSplitOffset = 4080;
  const initialChunk = new Uint8Array(
    firstFrame.length + secondFrameSplitOffset,
  );

  initialChunk.set(firstFrame);
  initialChunk.set(
    secondFrame.subarray(0, secondFrameSplitOffset),
    firstFrame.length,
  );

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", initialChunk);
  assertEquals(messages.debug, [[`[ledger] ${firstMessage}`]]);

  stream.emit("data", secondFrame.subarray(secondFrameSplitOffset));
  assertEquals(messages.debug, [
    [`[ledger] ${firstMessage}`],
    [`[ledger] ${secondMessage}`],
  ]);
});

Deno.test("streamContainerLogs grows buffered partial frames when compaction is insufficient", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });
  const firstMessage = "a".repeat(4000);
  const secondMessage = "b".repeat(9000);
  const firstFrame = createDockerLogFrame(firstMessage);
  const secondFrame = createDockerLogFrame(secondMessage);
  const secondFrameSplitOffset = 4080;
  const initialChunk = new Uint8Array(
    firstFrame.length + secondFrameSplitOffset,
  );

  initialChunk.set(firstFrame);
  initialChunk.set(
    secondFrame.subarray(0, secondFrameSplitOffset),
    firstFrame.length,
  );

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", new Uint8Array());
  assertEquals(messages.debug, []);

  stream.emit("data", initialChunk);
  assertEquals(messages.debug, [[`[ledger] ${firstMessage}`]]);

  stream.emit("data", secondFrame.subarray(secondFrameSplitOffset));
  assertEquals(messages.debug, [
    [`[ledger] ${firstMessage}`],
    [`[ledger] ${secondMessage}`],
  ]);
});

Deno.test("streamContainerLogs wraps attachment failures", async () => {
  const { logger } = createLoggerSpy();
  const container = {
    logs: () => Promise.reject(new Error("attach failed")),
  } as unknown as Container;

  const error = await assertRejects(
    () =>
      streamContainerLogs({
        container,
        logger,
        tag: "[ledger]",
      }),
    CONTAINER_ERROR,
    "Failed to stream container logs.",
  );
  assertStrictEquals(error.code, Code.CONTAINER_ERROR);
});

Deno.test("streamContainerLogs flushes buffered data and logs stream errors", async () => {
  const stream = new EventEmitter();
  const { logger, messages } = createLoggerSpy();
  const container = createFakeContainer(createInspectInfo(), {
    logStream: stream,
  });

  await streamContainerLogs({
    container,
    logger,
    tag: "[ledger]",
  });

  stream.emit("data", new TextEncoder().encode("plain"));
  const emitted = stream.emit("error", new Error("stream failed"));

  assertEquals(emitted, true);
  assertEquals(messages.debug, [["[ledger] plain"]]);
  assertEquals(messages.error.length, 1);
  assertInstanceOf(messages.error[0][0], CONTAINER_ERROR);
  assertStrictEquals(
    (messages.error[0][0] as CONTAINER_ERROR).code,
    Code.CONTAINER_ERROR,
  );
});

Deno.test("waitForLedgerReady succeeds after transient failures", async () => {
  let fetchCalls = 0;
  let sleepCalls = 0;
  const inspectInfo = createInspectInfo();
  const dockerClient = {
    getContainer: () => createFakeContainer(inspectInfo),
  } as unknown as DockerClientLike;

  await waitForLedgerReady({
    containerId: "container-id",
    dockerClient,
    friendbotReadyFn: () => Promise.resolve(),
    sleepFn: () => {
      sleepCalls += 1;
      return Promise.resolve();
    },
    fetchFn: (input) => {
      fetchCalls += 1;
      const url = String(input);

      if (fetchCalls === 1) {
        return Promise.resolve(new Response("booting", { status: 503 }));
      }

      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(createRpcHealthResponse("healthy"), { status: 200 }),
        );
      }

      return Promise.resolve(new Response("ok", { status: 200 }));
    },
  });

  assertEquals(fetchCalls >= 3, true);
  assertEquals(sleepCalls, 1);
});

Deno.test("waitForLedgerReady uses the configured Docker host when no override is provided", async () => {
  const inspectInfo = createInspectInfo();
  const dockerClient = {
    getContainer: () => createFakeContainer(inspectInfo),
  } as unknown as DockerClientLike;
  const requestedUrls: string[] = [];

  await waitForLedgerReady({
    containerId: "container-id",
    dockerClient,
    dockerOptions: { host: "docker.internal", port: 2375 },
    sleepFn: () => Promise.resolve(),
    fetchFn: (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(createRpcHealthResponse("healthy"), { status: 200 }),
        );
      }

      return Promise.resolve(new Response("ok", { status: 200 }));
    },
  });

  assertEquals(requestedUrls, [
    "http://docker.internal:18000",
    "http://docker.internal:18000/rpc",
    "http://docker.internal:18000/friendbot",
  ]);
});

Deno.test("waitForLedgerReady waits for Friendbot to return a non-5xx response", async () => {
  const inspectInfo = createInspectInfo();
  const requestedUrls: string[] = [];
  let sleepCalls = 0;
  const dockerClient = {
    getContainer: () => createFakeContainer(inspectInfo),
  } as unknown as DockerClientLike;

  await waitForLedgerReady({
    containerId: "container-id",
    dockerClient,
    sleepFn: () => {
      sleepCalls += 1;
      return Promise.resolve();
    },
    fetchFn: (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.endsWith("/rpc")) {
        return Promise.resolve(
          new Response(createRpcHealthResponse("healthy"), { status: 200 }),
        );
      }

      if (url.endsWith("/friendbot")) {
        if (sleepCalls === 0) {
          return Promise.resolve(new Response("bad gateway", { status: 502 }));
        }

        return Promise.resolve(
          new Response("Missing addr query parameter", { status: 400 }),
        );
      }

      return Promise.resolve(new Response("ok", { status: 200 }));
    },
  });

  assertEquals(sleepCalls, 1);
  assertEquals(
    requestedUrls.includes("http://127.0.0.1:18000/friendbot"),
    true,
  );
});

Deno.test("waitForLedgerReady times out with both Error and string failures", async () => {
  const stalledNow = (() => {
    const values = [0, 0, 10, 20];
    return () => values.shift() ?? 20;
  })();

  const stoppedError = await assertRejects(
    () =>
      waitForLedgerReady({
        containerId: "container-id",
        dockerClient: {
          getContainer: () =>
            createFakeContainer(
              createInspectInfo({
                State: {
                  Running: false,
                  Status: "exited",
                  ExitCode: 1,
                },
              }),
            ),
        } as unknown as DockerClientLike,
        timeoutMs: 15,
        nowFn: stalledNow,
        sleepFn: () => Promise.resolve(undefined),
      }),
    READINESS_ERROR,
    "Container is not running",
  );
  assertStrictEquals(stoppedError.code, Code.READINESS_ERROR);

  const throwingNow = (() => {
    const values = [0, 0, 10, 20];
    return () => values.shift() ?? 20;
  })();

  const stringCauseError = await assertRejects(
    () =>
      waitForLedgerReady({
        containerId: "container-id",
        dockerClient: {
          getContainer: () => createFakeContainer(createInspectInfo()),
        } as unknown as DockerClientLike,
        timeoutMs: 15,
        nowFn: throwingNow,
        sleepFn: () => Promise.resolve(undefined),
        fetchFn: () => Promise.reject("boom"),
      }),
    READINESS_ERROR,
    '"boom"',
  );
  assertStrictEquals(stringCauseError.code, Code.READINESS_ERROR);

  const weirdNow = (() => {
    const values = [0, 0, 10, 20];
    return () => values.shift() ?? 20;
  })();
  const circularCause: { label: string; self?: unknown; toString(): string } = {
    label: "circular",
    toString() {
      return "circular-runtime";
    },
  };
  circularCause.self = circularCause;

  const objectCauseError = await assertRejects(
    () =>
      waitForLedgerReady({
        containerId: "container-id",
        dockerClient: {
          getContainer: () => createFakeContainer(createInspectInfo()),
        } as unknown as DockerClientLike,
        timeoutMs: 15,
        nowFn: weirdNow,
        sleepFn: () => Promise.resolve(undefined),
        fetchFn: () => Promise.reject(circularCause),
      }),
    READINESS_ERROR,
    "circular-runtime",
  );
  assertStrictEquals(objectCauseError.code, Code.READINESS_ERROR);
});

Deno.test("waitForLedgerReady times out when the RPC endpoint is unhealthy", async () => {
  const rpcNow = (() => {
    const values = [0, 0, 10, 20];
    return () => values.shift() ?? 20;
  })();

  const rpcError = await assertRejects(
    () =>
      waitForLedgerReady({
        containerId: "container-id",
        dockerClient: {
          getContainer: () => createFakeContainer(createInspectInfo()),
        } as unknown as DockerClientLike,
        timeoutMs: 15,
        nowFn: rpcNow,
        sleepFn: () => Promise.resolve(undefined),
        fetchFn: (input) => {
          const url = String(input);
          if (url.endsWith("/rpc")) {
            return Promise.resolve(
              new Response(createRpcHealthResponse("starting"), {
                status: 200,
              }),
            );
          }

          return Promise.resolve(new Response("ok", { status: 200 }));
        },
      }),
    READINESS_ERROR,
    "RPC is not ready yet",
  );
  assertStrictEquals(rpcError.code, Code.READINESS_ERROR);
});

Deno.test("waitForLedgerReady times out when Friendbot cannot fund accounts", async () => {
  const friendbotNow = (() => {
    const values = [0, 0, 10, 20];
    return () => values.shift() ?? 20;
  })();

  const friendbotError = await assertRejects(
    () =>
      waitForLedgerReady({
        containerId: "container-id",
        dockerClient: {
          getContainer: () => createFakeContainer(createInspectInfo()),
        } as unknown as DockerClientLike,
        timeoutMs: 15,
        nowFn: friendbotNow,
        sleepFn: () => Promise.resolve(undefined),
        fetchFn: (input) => {
          const url = String(input);
          if (url.endsWith("/rpc")) {
            return Promise.resolve(
              new Response(createRpcHealthResponse("healthy"), {
                status: 200,
              }),
            );
          }

          return Promise.resolve(new Response("ok", { status: 200 }));
        },
        friendbotReadyFn: () =>
          Promise.reject(new Error("friendbot still returning 502")),
      }),
    READINESS_ERROR,
    "friendbot still returning 502",
  );

  assertStrictEquals(friendbotError.code, Code.READINESS_ERROR);
});

Deno.test("waitForLedgerReady treats invalid RPC health JSON as unhealthy", async () => {
  const rpcNow = (() => {
    const values = [0, 0, 10, 20];
    return () => values.shift() ?? 20;
  })();

  const rpcError = await assertRejects(
    () =>
      waitForLedgerReady({
        containerId: "container-id",
        dockerClient: {
          getContainer: () => createFakeContainer(createInspectInfo()),
        } as unknown as DockerClientLike,
        timeoutMs: 15,
        nowFn: rpcNow,
        sleepFn: () => Promise.resolve(undefined),
        fetchFn: (input) => {
          const url = String(input);
          if (url.endsWith("/rpc")) {
            return Promise.resolve(
              new Response("definitely-not-json", { status: 200 }),
            );
          }

          return Promise.resolve(new Response("ok", { status: 200 }));
        },
      }),
    READINESS_ERROR,
    "RPC is not ready yet",
  );
  assertStrictEquals(rpcError.code, Code.READINESS_ERROR);
});
