import { Buffer } from "node:buffer";
import type Dockerode from "dockerode";
import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as E from "@/error.ts";
import {
  buildDockerCommand,
  demultiplexDockerLogs,
  detectDockerOptions,
  DockerBuildRunner,
  resolveDockerOptions,
} from "@/docker-runner.ts";
import { DEFAULT_BUILD_VERIFICATION_LIMITS } from "@/types.ts";
import type { ContractBuildRunnerInput } from "@/types.ts";

const input = (): ContractBuildRunnerInput => ({
  sourceDirectory: "/source",
  recipe: {
    image: `docker.io/stellar/stellar-cli@sha256:${"a".repeat(64)}`,
    arguments: ["contract", "build"],
    options: ["--package=hello", "--meta=ignored"],
    metadata: [{ key: "name", value: "hello" }],
  },
  allowNetwork: false,
  limits: DEFAULT_BUILD_VERIFICATION_LIMITS,
});

const frame = (stream: 1 | 2, text: string): Uint8Array => {
  const value = new TextEncoder().encode(text);
  const bytes = new Uint8Array(8 + value.length);
  bytes[0] = stream;
  new DataView(bytes.buffer).setUint32(4, value.length);
  bytes.set(value, 8);
  return bytes;
};

describe("Docker runner helpers", () => {
  it("resolves explicit Docker settings and supported DOCKER_HOST forms", () => {
    assertEquals(
      resolveDockerOptions({ dockerSocketPath: "/socket" }, undefined),
      { socketPath: "/socket" },
    );
    assertEquals(
      resolveDockerOptions(
        { dockerOptions: { host: "host", port: 1 } },
        undefined,
      ),
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

  it("rejects empty, conflicting, invalid, and unsupported Docker settings", () => {
    assertThrows(
      () => resolveDockerOptions({ dockerSocketPath: " " }),
      E.DockerConfigurationFailedError,
    );
    assertThrows(
      () =>
        resolveDockerOptions({
          dockerSocketPath: "/a",
          dockerOptions: { socketPath: "/b" },
        }),
      E.DockerConfigurationFailedError,
    );
    assertThrows(
      () => resolveDockerOptions({}, " "),
      E.DockerConfigurationFailedError,
    );
    assertThrows(
      () => resolveDockerOptions({}, "not a url"),
      E.DockerConfigurationFailedError,
    );
    assertThrows(
      () => resolveDockerOptions({}, "ftp://docker.example"),
      E.DockerConfigurationFailedError,
    );
  });

  it("rejects more than one distinct detected Docker socket", async () => {
    const directory = await Deno.makeTempDir();
    const first = `${directory}/first.sock`;
    const second = `${directory}/second.sock`;
    await Deno.writeTextFile(first, "");
    await Deno.writeTextFile(second, "");
    try {
      assertThrows(
        () => detectDockerOptions([first, second]),
        E.DockerConfigurationFailedError,
      );
      assertEquals(
        detectDockerOptions([first, first]).socketPath?.endsWith("/first.sock"),
        true,
      );
      assertEquals(detectDockerOptions([`${directory}/missing`]), {});
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("builds structured arguments and replays metadata once", () => {
    assertEquals(buildDockerCommand(input()), [
      "contract",
      "build",
      "--package=hello",
      "--meta",
      "name=hello",
    ]);
  });

  it("decodes raw and multiplexed Docker logs with a bound", () => {
    assertEquals(demultiplexDockerLogs("plain", 100), {
      stdout: "plain",
      stderr: "",
    });
    const bytes = Buffer.concat([
      Buffer.from(frame(1, "out")),
      Buffer.from(frame(2, "err")),
    ]);
    assertEquals(demultiplexDockerLogs(bytes, 100), {
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
  });

  it("rejects malformed multiplexed logs", () => {
    const malformed = frame(1, "out").subarray(0, 9);
    assertThrows(
      () => demultiplexDockerLogs(Buffer.from(malformed), 100),
      E.BuildLogCollectionFailedError,
    );
  });

  it("maps every Docker boundary failure to its own error", async () => {
    const directory = await Deno.makeTempDir();
    const base = {
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
          }),
      }),
      createContainer: () =>
        Promise.resolve({
          start: () => Promise.resolve(),
          wait: () => Promise.resolve({ StatusCode: 0 }),
          kill: () => Promise.resolve(),
          logs: () => Promise.resolve(Buffer.alloc(0)),
          remove: () => Promise.resolve(),
        }),
    };
    const run = (
      overrides: Record<string, unknown>,
      timeoutMs = DEFAULT_BUILD_VERIFICATION_LIMITS.timeoutMs,
    ) =>
      DockerBuildRunner.fromDockerClient(
        { ...base, ...overrides } as unknown as Dockerode,
      ).run({
        ...input(),
        sourceDirectory: directory,
        recipe: { ...input().recipe, options: [] },
        limits: { ...DEFAULT_BUILD_VERIFICATION_LIMITS, timeoutMs },
      });
    try {
      await assertRejects(
        () => run({ ping: () => Promise.reject(new Error("ping")) }),
        E.DockerUnavailableError,
      );
      await assertRejects(
        () =>
          run({
            pull: (
              _image: string,
              _options: unknown,
              callback: (error: unknown) => void,
            ) => callback(new Error("pull")),
          }),
        E.ImagePullFailedError,
      );
      await assertRejects(
        () =>
          run({
            pull: (
              _image: string,
              _options: unknown,
              callback: (
                error: unknown,
                stream?: NodeJS.ReadableStream,
              ) => void,
            ) => callback(undefined, undefined),
          }),
        E.ImagePullStreamMissingError,
      );
      await assertRejects(
        () =>
          run({
            modem: {
              followProgress: (
                _stream: NodeJS.ReadableStream,
                callback: (error?: unknown) => void,
              ) => callback(new Error("progress")),
            },
          }),
        E.ImagePullProgressFailedError,
      );
      await assertRejects(() =>
        run({
          pull: () => {
            throw new Error("synchronous pull");
          },
        }), E.ImagePullFailedError);
      await assertRejects(
        () =>
          run({
            getImage: () => ({
              inspect: () => Promise.reject(new Error("inspect")),
            }),
          }),
        E.ImageInspectionFailedError,
      );
      await assertRejects(
        () =>
          run({ createContainer: () => Promise.reject(new Error("create")) }),
        E.ContainerCreationFailedError,
      );
      await assertRejects(() =>
        run({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.reject(new Error("start")),
              remove: () => Promise.resolve(),
            }),
        }), E.ContainerStartFailedError);
      await assertRejects(() =>
        run({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.reject(new Error("wait")),
              remove: () => Promise.resolve(),
            }),
        }), E.ContainerWaitFailedError);
      await assertRejects(() =>
        run({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => new Promise(() => {}),
              kill: () => Promise.resolve(),
              logs: () => Promise.resolve(Buffer.alloc(0)),
              remove: () => Promise.resolve(),
            }),
        }, 1), E.BuildTimedOutError);
      await assertRejects(() =>
        run({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => new Promise(() => {}),
              kill: () => Promise.reject(new Error("kill")),
              remove: () => Promise.resolve(),
            }),
        }, 1), E.ContainerKillFailedError);
      await assertRejects(() =>
        run({
          createContainer: () =>
            Promise.resolve({
              start: () => Promise.resolve(),
              wait: () => Promise.resolve({ StatusCode: 0 }),
              logs: () => Promise.reject(new Error("logs")),
              remove: () => Promise.resolve(),
            }),
        }), E.ContainerLogsFailedError);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("retains the primary error and separately reports cleanup failure", async () => {
    const directory = await Deno.makeTempDir();
    const artifact = `${directory}/target/wasm32v1-none/release/hello.wasm`;
    let createOptions: Record<string, unknown> | undefined;
    const client = (statusCode: number) => ({
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
          }),
      }),
      createContainer: (options: Record<string, unknown>) => {
        createOptions = options;
        return Promise.resolve({
          start: async () => {
            await Deno.mkdir(`${directory}/target/wasm32v1-none/release`, {
              recursive: true,
            });
            await Deno.writeFile(
              artifact,
              new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
            );
          },
          wait: () => Promise.resolve({ StatusCode: statusCode }),
          logs: () => Promise.resolve(Buffer.alloc(0)),
          remove: () => Promise.reject(new Error("cleanup")),
        });
      },
    });
    try {
      await assertRejects(
        () =>
          DockerBuildRunner.fromDockerClient(client(1) as unknown as Dockerode)
            .run({ ...input(), sourceDirectory: directory }),
        E.BuildCommandFailedError,
      );
      await Deno.remove(`${directory}/target`, { recursive: true });
      await assertRejects(
        () =>
          DockerBuildRunner.fromDockerClient(client(0) as unknown as Dockerode)
            .run({ ...input(), sourceDirectory: directory }),
        E.ContainerCleanupFailedError,
      );
      const hostConfig = createOptions?.HostConfig as { NetworkMode: string };
      assertEquals(hostConfig.NetworkMode, "none");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
