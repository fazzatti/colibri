import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type Dockerode from "dockerode";
import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TEST_LIMITS, testImageDetails } from "@/testing.test.ts";
import type { ContractBuildPlan } from "@/runners/types.ts";
import { buildDockerCommand } from "@/runners/docker/command.ts";
import {
  detectDockerOptions,
  resolveDockerOptions,
} from "@/runners/docker/connection.ts";
import {
  BuildCommandFailedError,
  BuildLogCollectionFailedError,
  BuildPlanInvalidError,
  BuildRunnerUnexpectedError,
  BuildTimedOutError,
  ContainerCleanupFailedError,
  ContainerCreationFailedError,
  ContainerKillFailedError,
  ContainerLogsFailedError,
  ContainerStartFailedError,
  ContainerWaitFailedError,
  DockerConfigurationFailedError,
  DockerContainerNamePrefixInvalidError,
  DockerUnavailableError,
  ImageInspectionFailedError,
  ImagePullFailedError,
  ImagePullProgressFailedError,
  ImagePullStreamMissingError,
  ImageRuntimeMismatchError,
  RuntimeImageDigestMismatchError,
  SourceBuildAccessPreparationFailedError,
} from "@/runners/docker/error.ts";
import {
  collectBoundedDockerLogStream,
  demultiplexDockerLogs,
} from "@/runners/docker/logs.ts";
import {
  attachDockerCleanupFailure,
  DockerBuildRunner,
  getDockerUserFromSourceOwner,
} from "@/runners/docker/runner.ts";

const plan = (
  overrides: Partial<ContractBuildPlan> = {},
): ContractBuildPlan => ({
  sourceDirectory: Deno.cwd(),
  image: testImageDetails(),
  arguments: ["contract", "build", "--package=hello"],
  rustupToolchain: "1.88.0",
  allowNetwork: false,
  limits: TEST_LIMITS,
  ...overrides,
});

const frame = (stream: 1 | 2, text: string): Uint8Array => {
  const value = new TextEncoder().encode(text);
  const bytes = new Uint8Array(8 + value.length);
  bytes[0] = stream;
  new DataView(bytes.buffer).setUint32(4, value.length);
  bytes.set(value, 8);
  return bytes;
};

const logStream = (...chunks: Uint8Array[]): NodeJS.ReadableStream =>
  Readable.from(chunks.map((chunk) => Buffer.from(chunk)));

const eventLogStream = (): EventEmitter & NodeJS.ReadableStream => {
  const stream = new EventEmitter() as EventEmitter & NodeJS.ReadableStream;
  stream.resume = () => stream;
  return stream;
};

const mockContainer = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  attach: () => Promise.resolve(logStream()),
  start: () => Promise.resolve(),
  wait: () => Promise.resolve({ StatusCode: 0 }),
  kill: () => Promise.resolve(),
  remove: () => Promise.resolve(),
  ...overrides,
});

const baseDocker = (
  containerOverrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ping: () => Promise.resolve("OK"),
  pull: (
    _image: string,
    _options: unknown,
    callback: (error: unknown, stream?: NodeJS.ReadableStream) => void,
  ) => callback(undefined, {} as NodeJS.ReadableStream),
  modem: {
    followProgress: (
      _stream: NodeJS.ReadableStream,
      callback: (error?: unknown) => void,
    ) => callback(),
  },
  getImage: () => ({
    inspect: () =>
      Promise.resolve({
        Config: { Entrypoint: ["stellar"], WorkingDir: "/source" },
        RepoDigests: [
          `stellar/stellar-cli@${testImageDetails().manifestDigest}`,
        ],
      }),
  }),
  createContainer: () => Promise.resolve(mockContainer(containerOverrides)),
});

const runWith = (
  overrides: Record<string, unknown>,
  input: ContractBuildPlan = plan(),
) =>
  DockerBuildRunner.fromDockerClient(
    { ...baseDocker(), ...overrides } as unknown as Dockerode,
  ).run(input);

describe("Docker runner", () => {
  it("resolves explicit Docker settings and supported DOCKER_HOST forms", () => {
    assertEquals(
      resolveDockerOptions({ dockerSocketPath: "/socket" }, undefined),
      {
        socketPath: "/socket",
      },
    );
    assertEquals(
      resolveDockerOptions({
        dockerOptions: { host: "host", port: 1 },
      }, undefined),
      { host: "host", port: 1 },
    );
    assertEquals(
      resolveDockerOptions({
        dockerOptions: { socketPath: "/socket" },
        dockerSocketPath: "/socket",
      }, undefined),
      { socketPath: "/socket" },
    );
    assertEquals(
      resolveDockerOptions({
        dockerOptions: { host: "remote", port: 1234 },
        dockerSocketPath: "/socket",
      }, undefined),
      { socketPath: "/socket" },
    );
    assertEquals(resolveDockerOptions({}, "unix:///socket"), {
      socketPath: "/socket",
    });
    assertEquals(resolveDockerOptions({}, "npipe:////./pipe/docker"), {
      socketPath: "//./pipe/docker",
    });
    assertEquals(resolveDockerOptions({}, "/socket"), {
      socketPath: "/socket",
    });
    assertEquals(resolveDockerOptions({}, "tcp://docker.example:1234"), {
      protocol: "http",
      host: "docker.example",
      port: 1234,
    });
    assertEquals(resolveDockerOptions({}, "https://docker.example"), {
      protocol: "https",
      host: "docker.example",
      port: 2376,
    });
    assertEquals(resolveDockerOptions({}, "http://docker.example"), {
      protocol: "http",
      host: "docker.example",
      port: 2375,
    });
    assertEquals(typeof resolveDockerOptions(), "object");
    assert(
      new DockerBuildRunner({ dockerSocketPath: "/socket" }) instanceof
        DockerBuildRunner,
    );
  });

  it("rejects ambiguous or invalid Docker settings", () => {
    assertThrows(
      () => resolveDockerOptions({ dockerSocketPath: " " }),
      DockerConfigurationFailedError,
    );
    assertThrows(
      () =>
        resolveDockerOptions({
          dockerSocketPath: "/a",
          dockerOptions: { socketPath: "/b" },
        }),
      DockerConfigurationFailedError,
    );
    for (const host of [" ", "not a url", "ftp://docker.example"]) {
      assertThrows(
        () => resolveDockerOptions({}, host),
        DockerConfigurationFailedError,
      );
    }
  });

  it("detects zero, one, duplicate, and ambiguous Docker sockets", async () => {
    const directory = await Deno.makeTempDir();
    const first = `${directory}/first.sock`;
    const second = `${directory}/second.sock`;
    await Deno.writeTextFile(first, "");
    await Deno.writeTextFile(second, "");
    try {
      assertEquals(detectDockerOptions([`${directory}/missing`]), {});
      assert(detectDockerOptions([first]).socketPath?.endsWith("/first.sock"));
      assert(
        detectDockerOptions([first, first]).socketPath?.endsWith("/first.sock"),
      );
      assertThrows(
        () => detectDockerOptions([first, second]),
        DockerConfigurationFailedError,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("preserves the structured build argument vector", () => {
    assertEquals(buildDockerCommand(plan()), [
      "contract",
      "build",
      "--package=hello",
    ]);
    for (const arguments_ of [[], [""], ["contract", ""]]) {
      assertThrows(
        () => buildDockerCommand(plan({ arguments: arguments_ })),
        BuildPlanInvalidError,
      );
    }
  });

  it("aligns POSIX build ownership and lets non-POSIX hosts use the image user", () => {
    assertEquals(
      getDockerUserFromSourceOwner({ uid: 1001, gid: 1002 }),
      "1001:1002",
    );
    assertEquals(
      getDockerUserFromSourceOwner({ uid: null, gid: 1002 }),
      undefined,
    );
    assertEquals(
      getDockerUserFromSourceOwner({ uid: 1001, gid: null }),
      undefined,
    );
  });

  it("decodes and bounds raw, buffered, and streamed Docker logs", async () => {
    assertEquals(demultiplexDockerLogs("plain", 100), {
      stdout: "plain",
      stderr: "",
    });
    const multiplexed = Buffer.concat([
      Buffer.from(frame(1, "out")),
      Buffer.from(frame(2, "err")),
    ]);
    assertEquals(demultiplexDockerLogs(multiplexed, 100), {
      stdout: "out",
      stderr: "err",
    });
    assertEquals(
      demultiplexDockerLogs("long", 2).stdout,
      "lo\n[logs truncated by Colibri]",
    );
    for (
      const bytes of [
        new Uint8Array(8),
        new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0]),
        new Uint8Array([1, 0, 1, 0, 0, 0, 0, 0]),
        new Uint8Array([1, 0, 0, 1, 0, 0, 0, 0]),
      ]
    ) {
      assertEquals(demultiplexDockerLogs(Buffer.from(bytes), 100).stderr, "");
    }
    assertThrows(
      () =>
        demultiplexDockerLogs(Buffer.from(frame(1, "out").subarray(0, 9)), 100),
      BuildLogCollectionFailedError,
    );
    assertThrows(
      () =>
        demultiplexDockerLogs(
          Buffer.concat([Buffer.from(frame(1, "out")), Buffer.from([1])]),
          100,
        ),
      BuildLogCollectionFailedError,
    );
    assertEquals(
      await collectBoundedDockerLogStream(
        logStream(
          frame(1, "long output"),
          frame(2, "error output"),
        ),
        4,
      ),
      {
        stdout: "long\n[logs truncated by Colibri]",
        stderr: "erro\n[logs truncated by Colibri]",
      },
    );
    const split = frame(1, "split");
    assertEquals(
      await collectBoundedDockerLogStream(
        logStream(
          split.subarray(0, 3),
          split.subarray(3, 8),
          split.subarray(8),
          frame(1, ""),
        ),
        100,
      ),
      { stdout: "split", stderr: "" },
    );
    assertEquals(
      await collectBoundedDockerLogStream(
        Readable.from([String.fromCharCode(...frame(2, "string"))]),
        100,
      ),
      { stdout: "", stderr: "string" },
    );
    await assertRejects(
      () =>
        collectBoundedDockerLogStream(
          logStream(frame(1, "out").subarray(0, 9)),
          100,
        ),
      BuildLogCollectionFailedError,
    );
    await assertRejects(
      () =>
        collectBoundedDockerLogStream(
          logStream(new Uint8Array([3, 0, 0, 0, 0, 0, 0, 0])),
          100,
        ),
      BuildLogCollectionFailedError,
    );

    const nonByte = eventLogStream();
    const nonByteResult = collectBoundedDockerLogStream(nonByte, 100);
    nonByte.emit("data", 1);
    await assertRejects(() => nonByteResult, BuildLogCollectionFailedError);

    const failed = eventLogStream();
    const failedResult = collectBoundedDockerLogStream(failed, 100);
    failed.emit("error", new BuildLogCollectionFailedError(new Error("log")));
    await assertRejects(() => failedResult, BuildLogCollectionFailedError);

    const closed = eventLogStream();
    const closedResult = collectBoundedDockerLogStream(closed, 100);
    closed.emit("close");
    await assertRejects(() => closedResult, BuildLogCollectionFailedError);

    const repeated = eventLogStream();
    repeated.removeListener = () => repeated;
    const repeatedResult = collectBoundedDockerLogStream(repeated, 100);
    repeated.emit("data", 1);
    repeated.emit("error", new Error("already settled"));
    repeated.emit("end");
    await assertRejects(() => repeatedResult, BuildLogCollectionFailedError);
  });

  it("rejects invalid execution plans before Docker is contacted", async () => {
    const runner = DockerBuildRunner.fromDockerClient(
      baseDocker() as unknown as Dockerode,
    );
    await assertRejects(
      () => runner.run(plan({ sourceDirectory: "" })),
      BuildPlanInvalidError,
    );
    await assertRejects(
      () =>
        runner.run(
          plan({ sourceDirectory: "/definitely/missing/colibri-source" }),
        ),
      SourceBuildAccessPreparationFailedError,
    );
    await assertRejects(
      () => runner.run(plan({ rustupToolchain: "" })),
      BuildPlanInvalidError,
    );
    await assertRejects(
      () =>
        runner.run(plan({
          image: testImageDetails({ reference: "docker.io/wrong@sha256:bad" }),
        })),
      BuildPlanInvalidError,
    );
  });

  it("maps daemon, pull, inspection, and image-contract failures", async () => {
    await assertRejects(
      () => runWith({ ping: () => Promise.reject(new Error("ping")) }),
      DockerUnavailableError,
    );
    await assertRejects(
      () =>
        runWith({
          pull: (
            _image: string,
            _options: unknown,
            callback: (error: unknown) => void,
          ) => callback(new Error("pull")),
        }),
      ImagePullFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          pull: (
            _image: string,
            _options: unknown,
            callback: (error: unknown, stream?: NodeJS.ReadableStream) => void,
          ) => callback(undefined, undefined),
        }),
      ImagePullStreamMissingError,
    );
    await assertRejects(
      () =>
        runWith({
          modem: {
            followProgress: (
              _stream: NodeJS.ReadableStream,
              callback: (error?: unknown) => void,
            ) => callback(new Error("progress")),
          },
        }),
      ImagePullProgressFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          pull: () => {
            throw new Error("sync pull");
          },
        }),
      ImagePullFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          getImage: () => ({
            inspect: () => Promise.reject(new Error("inspect")),
          }),
        }),
      ImageInspectionFailedError,
    );
    for (
      const Config of [
        { Entrypoint: undefined, WorkingDir: "/source" },
        { Entrypoint: ["not-stellar"], WorkingDir: "/source" },
        { Entrypoint: ["stellar"], WorkingDir: "/workspace" },
      ]
    ) {
      await assertRejects(
        () =>
          runWith({
            getImage: () => ({
              inspect: () => Promise.resolve({ Config, RepoDigests: [] }),
            }),
          }),
        ImageRuntimeMismatchError,
      );
    }
    await assertRejects(
      () =>
        runWith({
          getImage: () => ({
            inspect: () =>
              Promise.resolve({
                Config: { Entrypoint: ["stellar"], WorkingDir: "/source" },
                RepoDigests: undefined,
              }),
          }),
        }),
      RuntimeImageDigestMismatchError,
    );
  });

  it("maps every container lifecycle failure", async () => {
    await assertRejects(
      () =>
        runWith({ createContainer: () => Promise.reject(new Error("create")) }),
      ContainerCreationFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              start: () => Promise.reject(new Error("start")),
            })),
        }),
      ContainerStartFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () => {
            const stream = new Readable({
              read() {
                this.destroy(new Error("log stream"));
              },
            });
            return Promise.resolve(mockContainer({
              attach: () => Promise.resolve(stream),
              start: () => Promise.reject(new Error("start")),
            }));
          },
        }),
      ContainerStartFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              wait: () => Promise.reject(new Error("wait")),
            })),
        }),
      ContainerWaitFailedError,
    );
    const shortPlan = plan({ limits: { ...TEST_LIMITS, timeoutMs: 1 } });
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              attach: () => Promise.resolve(logStream(frame(1, "timed out"))),
              wait: () => new Promise(() => {}),
              kill: () => Promise.resolve(),
            })),
        }, shortPlan),
      BuildTimedOutError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              wait: () => new Promise(() => {}),
              kill: () => Promise.reject(new Error("kill")),
            })),
        }, shortPlan),
      ContainerKillFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              attach: () => Promise.reject(new Error("logs")),
            })),
        }),
      ContainerLogsFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              attach: () => Promise.resolve(logStream(frame(2, "failed"))),
              wait: () => Promise.resolve({ StatusCode: 9 }),
            })),
        }),
      BuildCommandFailedError,
    );
    const limits = { ...TEST_LIMITS };
    Object.defineProperty(limits, "maxLogBytes", {
      get: () => {
        throw new Error("unexpected limit failure");
      },
    });
    await assertRejects(
      () => runWith({}, plan({ limits })),
      BuildRunnerUnexpectedError,
    );
  });

  it("runs with an exact image, hardened limits, and selected network mode", async () => {
    for (const allowNetwork of [false, true]) {
      let createOptions: Record<string, unknown> | undefined;
      const docker = {
        ...baseDocker(),
        createContainer: (options: Record<string, unknown>) => {
          createOptions = options;
          return Promise.resolve(mockContainer({
            attach: () =>
              Promise.resolve(logStream(frame(1, "out"), frame(2, "err"))),
          }));
        },
      };
      const output = await DockerBuildRunner.fromDockerClient(
        docker as unknown as Dockerode,
      ).run(plan({ allowNetwork }));
      assertEquals(output.stdout, "out");
      assertEquals(output.stderr, "err");
      assertEquals(
        output.runtimeImageDigest,
        testImageDetails().manifestDigest,
      );
      assertEquals(output.runner, { name: "colibri-docker", version: "1" });
      assertEquals(output.capabilities.hardDiskLimit, false);
      const config = createOptions as {
        name: string;
        Image: string;
        Cmd: string[];
        Env: string[];
        Labels: Record<string, string>;
        User?: string;
        platform: string;
        HostConfig: Record<string, unknown>;
      };
      assertMatch(
        config.name,
        /^colibri-build-verification-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      assertEquals(config.Image, testImageDetails().reference);
      assertEquals(config.Cmd, plan().arguments);
      assertEquals(config.Env, [
        "RUSTUP_TOOLCHAIN=1.88.0",
        "CARGO_HOME=/cargo",
        "HOME=/tmp",
      ]);
      const owner = await Deno.stat(plan().sourceDirectory);
      assertEquals(config.User, `${owner.uid}:${owner.gid}`);
      assertEquals(config.Labels, {
        "dev.colibri.build-verification.runner": "1",
      });
      assertEquals(config.platform, "linux/amd64");
      assertEquals(
        config.HostConfig.NetworkMode,
        allowNetwork ? "bridge" : "none",
      );
      assertEquals(config.HostConfig.ReadonlyRootfs, true);
      assertEquals(config.HostConfig.CapDrop, ["ALL"]);
      assertEquals(config.HostConfig.LogConfig, {
        Type: "none",
        Config: {},
      });
      assertEquals(config.HostConfig.Tmpfs, {
        "/tmp": "rw,nosuid,nodev,size=268435456,mode=1777",
        "/cargo": "rw,nosuid,nodev,size=1610612736,mode=1777",
      });
    }
  });

  it("uses a caller prefix only as the prefix of a unique container name", async () => {
    const names: string[] = [];
    const docker = {
      ...baseDocker(),
      createContainer: (options: { name: string }) => {
        names.push(options.name);
        return Promise.resolve(mockContainer());
      },
    };
    const runner = DockerBuildRunner.fromDockerClient(
      docker as unknown as Dockerode,
      { containerNamePrefix: " custom.verifier " },
    );

    await runner.run(plan());
    await runner.run(plan());

    assertMatch(
      names[0],
      /^custom\.verifier-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assertMatch(
      names[1],
      /^custom\.verifier-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assertNotEquals(names[0], names[1]);

    for (const prefix of ["", " ", "-invalid", "invalid prefix", "/invalid"]) {
      assertThrows(
        () =>
          DockerBuildRunner.fromDockerClient(
            docker as unknown as Dockerode,
            { containerNamePrefix: prefix },
          ),
        DockerContainerNamePrefixInvalidError,
      );
    }
    assertThrows(
      () =>
        DockerBuildRunner.fromDockerClient(
          docker as unknown as Dockerode,
          { containerNamePrefix: 42 as unknown as string },
        ),
      DockerContainerNamePrefixInvalidError,
    );
  });

  it("lets Docker select a platform only when OCI facts omit it", async () => {
    let createOptions: Record<string, unknown> | undefined;
    const docker = {
      ...baseDocker(),
      createContainer: (options: Record<string, unknown>) => {
        createOptions = options;
        return Promise.resolve(mockContainer());
      },
    };
    const image = testImageDetails({ architecture: undefined, os: undefined });
    await DockerBuildRunner.fromDockerClient(
      docker as unknown as Dockerode,
    ).run(plan({ image }));
    assertEquals(createOptions?.platform, undefined);
  });

  it("retains a primary build error when cleanup also fails", async () => {
    const primary = await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              wait: () => Promise.resolve({ StatusCode: 1 }),
              remove: () => Promise.reject(new Error("cleanup")),
            })),
        }),
      BuildCommandFailedError,
    );
    assert(primary.meta);
    assert(
      "cleanupFailure" in (primary.meta.data.input as Record<string, unknown>),
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve(mockContainer({
              remove: () => Promise.reject(new Error("cleanup")),
            })),
        }),
      ContainerCleanupFailedError,
    );
  });

  it("normalizes an unexpected primary failure before attaching cleanup", () => {
    const cleanup = new ContainerCleanupFailedError(new Error("cleanup"));
    const error = attachDockerCleanupFailure("unexpected primary", cleanup);
    assert(error instanceof BuildRunnerUnexpectedError);
    assertEquals(error.meta?.cause, "unexpected primary");
    assert(
      "cleanupFailure" in (error.meta?.data.input as Record<string, unknown>),
    );
  });
});
