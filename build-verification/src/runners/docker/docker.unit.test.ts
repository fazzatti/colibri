import { Buffer } from "node:buffer";
import type Dockerode from "dockerode";
import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TEST_LIMITS, testImageDetails } from "../../testing.test.ts";
import type { ContractBuildPlan } from "../types.ts";
import { buildDockerCommand } from "./command.ts";
import { detectDockerOptions, resolveDockerOptions } from "./connection.ts";
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
  DockerUnavailableError,
  ImageInspectionFailedError,
  ImagePullFailedError,
  ImagePullProgressFailedError,
  ImagePullStreamMissingError,
  ImageRuntimeMismatchError,
  RuntimeImageDigestMismatchError,
} from "./error.ts";
import { demultiplexDockerLogs } from "./logs.ts";
import { attachDockerCleanupFailure, DockerBuildRunner } from "./runner.ts";

const plan = (
  overrides: Partial<ContractBuildPlan> = {},
): ContractBuildPlan => ({
  sourceDirectory: "/source",
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
  createContainer: () =>
    Promise.resolve({
      start: () => Promise.resolve(),
      wait: () => Promise.resolve({ StatusCode: 0 }),
      kill: () => Promise.resolve(),
      logs: () => Promise.resolve(Buffer.alloc(0)),
      remove: () => Promise.resolve(),
      ...containerOverrides,
    }),
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

  it("decodes and bounds raw and multiplexed Docker logs", () => {
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
            Promise.resolve({
              start: () => Promise.reject(new Error("start")),
              remove: () => Promise.resolve(),
            }),
        }),
      ContainerStartFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.reject(new Error("wait")),
              remove: () => Promise.resolve(),
            }),
        }),
      ContainerWaitFailedError,
    );
    const shortPlan = plan({ limits: { ...TEST_LIMITS, timeoutMs: 1 } });
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => new Promise(() => {}),
              kill: () => Promise.resolve(),
              logs: () => Promise.resolve(Buffer.from("timed out")),
              remove: () => Promise.resolve(),
            }),
        }, shortPlan),
      BuildTimedOutError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => new Promise(() => {}),
              kill: () => Promise.reject(new Error("kill")),
              remove: () => Promise.resolve(),
            }),
        }, shortPlan),
      ContainerKillFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.resolve({ StatusCode: 0 }),
              logs: () => Promise.reject(new Error("logs")),
              remove: () => Promise.resolve(),
            }),
        }),
      ContainerLogsFailedError,
    );
    await assertRejects(
      () =>
        runWith({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.resolve({ StatusCode: 9 }),
              logs: () => Promise.resolve(Buffer.from("failed")),
              remove: () => Promise.resolve(),
            }),
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
          return Promise.resolve({
            start: () => Promise.resolve(),
            wait: () => Promise.resolve({ StatusCode: 0 }),
            logs: () =>
              Promise.resolve(Buffer.concat([
                Buffer.from(frame(1, "out")),
                Buffer.from(frame(2, "err")),
              ])),
            remove: () => Promise.resolve(),
          });
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
        Image: string;
        Cmd: string[];
        Env: string[];
        Labels: Record<string, string>;
        platform: string;
        HostConfig: Record<string, unknown>;
      };
      assertEquals(config.Image, testImageDetails().reference);
      assertEquals(config.Cmd, plan().arguments);
      assertEquals(config.Env, ["RUSTUP_TOOLCHAIN=1.88.0"]);
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
    }
  });

  it("lets Docker select a platform only when OCI facts omit it", async () => {
    let createOptions: Record<string, unknown> | undefined;
    const docker = {
      ...baseDocker(),
      createContainer: (options: Record<string, unknown>) => {
        createOptions = options;
        return Promise.resolve({
          start: () => Promise.resolve(),
          wait: () => Promise.resolve({ StatusCode: 0 }),
          logs: () => Promise.resolve(Buffer.alloc(0)),
          remove: () => Promise.resolve(),
        });
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
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.resolve({ StatusCode: 1 }),
              logs: () => Promise.resolve(Buffer.alloc(0)),
              remove: () => Promise.reject(new Error("cleanup")),
            }),
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
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.resolve({ StatusCode: 0 }),
              logs: () => Promise.resolve(Buffer.alloc(0)),
              remove: () => Promise.reject(new Error("cleanup")),
            }),
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
