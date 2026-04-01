import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { realpathSync } from "node:fs";
import { Code, DOCKER_CONFIGURATION_ERROR } from "@/quickstart/error.ts";
import {
  autoDetectDockerOptions,
  createDockerClient,
  parseDockerHost,
  resolveDockerOptions,
  resolvePublishedPortHost,
  resolveSocketCandidatePaths,
} from "@/quickstart/docker.ts";

describe("Quickstart Docker helpers", () => {
  it("parseDockerHost supports unix, npipe, plain paths, tcp, and https", () => {
    assertEquals(parseDockerHost("unix:///tmp/docker.sock"), {
      socketPath: "/tmp/docker.sock",
    });
    assertEquals(parseDockerHost("npipe://./pipe/docker_engine"), {
      socketPath: "./pipe/docker_engine",
    });
    assertEquals(parseDockerHost("/tmp/docker.sock"), {
      socketPath: "/tmp/docker.sock",
    });
    assertEquals(parseDockerHost("tcp://docker.example:2375"), {
      protocol: "http",
      host: "docker.example",
      port: 2375,
    });
    assertEquals(parseDockerHost("tcp://docker.example"), {
      protocol: "http",
      host: "docker.example",
      port: 2375,
    });
    assertEquals(parseDockerHost("https://docker.example"), {
      protocol: "https",
      host: "docker.example",
      port: 2376,
    });
  });

  it("parseDockerHost rejects empty and unsupported values", () => {
    const emptyError = assertThrows(
      () => parseDockerHost("   "),
      DOCKER_CONFIGURATION_ERROR,
    );
    assertEquals(emptyError.code, Code.DOCKER_CONFIGURATION_ERROR);

    const protocolError = assertThrows(
      () => parseDockerHost("ssh://docker.example"),
      DOCKER_CONFIGURATION_ERROR,
    );
    assertEquals(protocolError.code, Code.DOCKER_CONFIGURATION_ERROR);
  });

  it("resolveSocketCandidatePaths deduplicates symlinked paths", async () => {
    const tempDir = await Deno.makeTempDir();
    const socketFile = `${tempDir}/docker.sock`;
    const symlinkFile = `${tempDir}/docker-link.sock`;

    await Deno.writeTextFile(socketFile, "");
    await Deno.symlink(socketFile, symlinkFile);

    try {
      const paths = resolveSocketCandidatePaths([
        socketFile,
        symlinkFile,
        `${tempDir}/missing.sock`,
      ]);

      assertEquals(paths, [realpathSync(socketFile)]);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("autoDetectDockerOptions handles zero, one, and many candidates", async () => {
    assertEquals(autoDetectDockerOptions([]), undefined);

    const tempDir = await Deno.makeTempDir();
    const first = `${tempDir}/one.sock`;
    const second = `${tempDir}/two.sock`;

    await Deno.writeTextFile(first, "");
    await Deno.writeTextFile(second, "");

    try {
      assertEquals(autoDetectDockerOptions([first]), {
        socketPath: realpathSync(first),
      });

      const error = assertThrows(
        () => autoDetectDockerOptions([first, second]),
        DOCKER_CONFIGURATION_ERROR,
      );
      assertEquals(error.code, Code.DOCKER_CONFIGURATION_ERROR);
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("resolveDockerOptions honors explicit options and DOCKER_HOST", () => {
    assertEquals(
      resolveDockerOptions({
        dockerOptions: { host: "docker.internal", port: 2375 },
      }),
      {
        host: "docker.internal",
        port: 2375,
      },
    );

    assertEquals(
      resolveDockerOptions({
        dockerOptions: {
          host: "docker.internal",
          port: 2375,
          protocol: "http",
          version: "v1.42",
        },
        dockerSocketPath: "/tmp/docker.sock",
      }),
      {
        version: "v1.42",
        socketPath: "/tmp/docker.sock",
      },
    );

    assertEquals(
      resolveDockerOptions({ dockerSocketPath: "/tmp/docker.sock" }),
      {
        socketPath: "/tmp/docker.sock",
      },
    );

    assertEquals(
      resolveDockerOptions(undefined, {
        dockerHost: "unix:///tmp/from-env.sock",
      }),
      {
        socketPath: "/tmp/from-env.sock",
      },
    );
  });

  it("resolveDockerOptions can use injected auto-detection dependencies", () => {
    assertEquals(
      resolveDockerOptions(undefined, {
        dockerHost: undefined,
        autoDetectDockerOptions: () => ({ socketPath: "/tmp/docker.sock" }),
      }),
      {
        socketPath: "/tmp/docker.sock",
      },
    );

    assertEquals(
      resolveDockerOptions(undefined, {
        dockerHost: undefined,
        autoDetectDockerOptions: () => undefined,
      }),
      {},
    );
  });

  it("resolvePublishedPortHost uses the Docker daemon host when needed", () => {
    assertEquals(
      resolvePublishedPortHost(undefined, {
        dockerHost: undefined,
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerSocketPath: "/var/run/docker.sock",
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { socketPath: "/var/run/docker.sock" },
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { host: "docker.internal", port: 2375 },
      }),
      "docker.internal",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { host: "http://192.168.1.10", port: 2375 },
      }),
      "192.168.1.10",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { host: "unix:///tmp/docker.sock" as unknown as string },
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { host: "   ", port: 2375 },
      }, {
        dockerHost: undefined,
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { port: 2375 },
      }, {
        dockerHost: undefined,
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { host: "0.0.0.0", port: 2375 },
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost({
        dockerOptions: { host: "::1", port: 2375 },
      }),
      "[::1]",
    );
    assertEquals(
      resolvePublishedPortHost(undefined, {
        dockerHost: "unix:///tmp/from-env.sock",
      }),
      "127.0.0.1",
    );
    assertEquals(
      resolvePublishedPortHost(undefined, {
        dockerHost: "tcp://docker.internal:2375",
      }),
      "docker.internal",
    );
  });

  it("resolveDockerOptions rejects conflicting socket settings", () => {
    const error = assertThrows(
      () =>
        resolveDockerOptions({
          dockerOptions: { socketPath: "/tmp/one.sock" },
          dockerSocketPath: "/tmp/two.sock",
        }),
      DOCKER_CONFIGURATION_ERROR,
    );
    assertEquals(error.code, Code.DOCKER_CONFIGURATION_ERROR);
  });

  it("createDockerClient instantiates a Dockerode client", () => {
    const client = createDockerClient({
      dockerOptions: { socketPath: "/tmp/docker.sock" },
    });

    assertExists(client);
  });
});
