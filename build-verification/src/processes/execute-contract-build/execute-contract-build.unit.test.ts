import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BuildArtifactSnapshotFailedError } from "@/artifacts/error.ts";
import type { BuildArtifactCandidate } from "@/artifacts/types.ts";
import { TEST_LIMITS, TEST_NOW, testWasm } from "@/testing.test.ts";
import {
  completeProcessState,
  imageProcessState,
} from "@/processes/testing.test.ts";
import {
  ExecuteContractBuildUnexpectedError,
  WorkspaceCleanupFailedError,
  WorkspaceInitializationFailedError,
} from "@/processes/execute-contract-build/error.ts";
import { executeContractBuild } from "@/processes/execute-contract-build/index.ts";

const execution = () => ({
  exitCode: 0 as const,
  stdout: "built",
  stderr: "warning",
  durationMs: 12,
  runtimeImageDigest: imageProcessState().value.image.manifestDigest,
  runner: { name: "fixture", version: "1" },
  capabilities: {
    networkIsolation: true,
    readOnlyRootFilesystem: true,
    cpuLimit: true,
    memoryLimit: true,
    pidLimit: true,
    timeout: true,
    hardDiskLimit: false,
  },
});

const candidate = (): BuildArtifactCandidate => {
  const bytes = testWasm();
  return {
    path: "/workspace/source/target/wasm32v1-none/release/fixture.wasm",
    bytes,
    size: bytes.length,
    sha256: "artifact-hash",
  };
};

describe("executeContractBuild", () => {
  it("passes terminal state through without touching workspace boundaries", async () => {
    const state = completeProcessState();
    assertEquals(
      await executeContractBuild({
        state,
        extractor: { extract: () => Promise.reject("unused") },
        runner: { run: () => Promise.reject("unused") },
        artifactCollector: {
          snapshot: () => Promise.reject("unused"),
          collect: () => Promise.reject("unused"),
        },
        allowBuildNetwork: false,
        limits: TEST_LIMITS,
      }),
      state,
    );
  });

  it("owns extraction, pre-build snapshot, execution, collection, and cleanup", async () => {
    const calls: string[] = [];
    let observedPlan: unknown;
    const before = new Map([["old.wasm", "old-hash"]]);
    const result = await executeContractBuild({
      state: imageProcessState({
        recipe: {
          ...imageProcessState().value.recipe,
          options: ["--package=fixture"],
          metadata: [{ key: "name", value: "fixture" }],
        },
      }),
      workspace: {
        makeTempDir: (options) => {
          assertEquals(options?.prefix, "colibri-build-verification-");
          calls.push("workspace");
          return Promise.resolve("/workspace");
        },
        remove: (path, options) => {
          assertEquals([path, options], ["/workspace", { recursive: true }]);
          calls.push("cleanup");
          return Promise.resolve();
        },
      },
      extractor: {
        extract: (input) => {
          assertEquals(input.workspaceDirectory, "/workspace");
          calls.push("extract");
          return Promise.resolve({
            sourceDirectory: "/workspace/source",
            format: "tar",
            files: 1,
            extractedBytes: 8,
          });
        },
      },
      artifactCollector: {
        snapshot: (directory) => {
          assertEquals(directory, "/workspace/source");
          calls.push("snapshot");
          return Promise.resolve(before);
        },
        collect: (directory, observedBefore) => {
          assertEquals(directory, "/workspace/source");
          assertEquals(observedBefore, before);
          calls.push("collect");
          return Promise.resolve([candidate()]);
        },
      },
      runner: {
        run: (input) => {
          observedPlan = input;
          calls.push("run");
          return Promise.resolve(execution());
        },
      },
      allowBuildNetwork: true,
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(calls, [
      "workspace",
      "extract",
      "snapshot",
      "run",
      "collect",
      "cleanup",
    ]);
    assertEquals((observedPlan as { arguments: string[] }).arguments, [
      "contract",
      "build",
      "--package=fixture",
      "--meta",
      "name=fixture",
    ]);
    assertEquals(
      (observedPlan as { allowNetwork: boolean }).allowNetwork,
      true,
    );
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.candidates, [candidate()]);
    assertEquals(
      (result.evidence.execution?.candidates[0] as Record<string, unknown>)
        .bytes,
      undefined,
    );
    assertEquals(result.evidence.execution?.networkEnabled, true);
    assertEquals(result.logs.at(-1)?.code, "BLDV_CONTRACT_BUILD_EXECUTED");
  });

  it("uses and removes a disposable system workspace by default", async () => {
    let workspaceDirectory = "";
    const result = await executeContractBuild({
      state: imageProcessState(),
      extractor: {
        extract: (input) => {
          workspaceDirectory = input.workspaceDirectory;
          return Promise.resolve({
            sourceDirectory: `${workspaceDirectory}/source`,
            files: 0,
            extractedBytes: 0,
          });
        },
      },
      artifactCollector: {
        snapshot: () => Promise.resolve(new Map()),
        collect: () => Promise.resolve([candidate()]),
      },
      runner: { run: () => Promise.resolve(execution()) },
      allowBuildNetwork: false,
      limits: TEST_LIMITS,
    });
    assertEquals(result.state, "active");
    assertEquals(
      workspaceDirectory.includes("colibri-build-verification-"),
      true,
    );
    await assertRejects(
      () => Deno.stat(workspaceDirectory),
      Deno.errors.NotFound,
    );
  });

  it("maps workspace creation and cleanup as separate occurrences", async () => {
    const common = {
      state: imageProcessState(),
      extractor: {
        extract: () =>
          Promise.resolve({
            sourceDirectory: "/workspace/source",
            files: 0,
            extractedBytes: 0,
          }),
      },
      runner: { run: () => Promise.resolve(execution()) },
      artifactCollector: {
        snapshot: () => Promise.resolve(new Map()),
        collect: () => Promise.resolve([]),
      },
      allowBuildNetwork: false,
      limits: TEST_LIMITS,
    };
    await assertRejects(
      () =>
        executeContractBuild({
          ...common,
          workspace: { makeTempDir: () => Promise.reject(new Error("create")) },
        }),
      WorkspaceInitializationFailedError,
    );
    await assertRejects(
      () =>
        executeContractBuild({
          ...common,
          workspace: {
            makeTempDir: () => Promise.resolve("/workspace"),
            remove: () => Promise.reject(new Error("cleanup")),
          },
        }),
      WorkspaceCleanupFailedError,
    );
  });

  it("preserves typed boundary failures while still cleaning the workspace", async () => {
    let cleaned = false;
    const error = await assertRejects(
      () =>
        executeContractBuild({
          state: imageProcessState(),
          workspace: {
            makeTempDir: () => Promise.resolve("/workspace"),
            remove: () => {
              cleaned = true;
              return Promise.resolve();
            },
          },
          extractor: {
            extract: () =>
              Promise.resolve({
                sourceDirectory: "/workspace/source",
                files: 0,
                extractedBytes: 0,
              }),
          },
          artifactCollector: {
            snapshot: () =>
              Promise.reject(
                new BuildArtifactSnapshotFailedError(
                  "/workspace/source",
                  "failure",
                ),
              ),
            collect: () => Promise.reject("unused"),
          },
          runner: { run: () => Promise.reject("unused") },
          allowBuildNetwork: false,
          limits: TEST_LIMITS,
        }),
      BuildArtifactSnapshotFailedError,
    );
    assertEquals(cleaned, true);
    assertEquals(error.meta?.data.evidence !== undefined, true);
  });

  it("normalizes untyped execution failures once", async () => {
    await assertRejects(
      () =>
        executeContractBuild({
          state: imageProcessState(),
          workspace: {
            makeTempDir: () => Promise.resolve("/workspace"),
            remove: () => Promise.resolve(),
          },
          extractor: { extract: () => Promise.reject("unexpected") },
          artifactCollector: {
            snapshot: () => Promise.reject("unused"),
            collect: () => Promise.reject("unused"),
          },
          runner: { run: () => Promise.reject("unused") },
          allowBuildNetwork: false,
          limits: TEST_LIMITS,
        }),
      ExecuteContractBuildUnexpectedError,
    );
  });

  it("retains the primary error and separately attaches cleanup failure", async () => {
    const error = await assertRejects(
      () =>
        executeContractBuild({
          state: imageProcessState(),
          workspace: {
            makeTempDir: () => Promise.resolve("/workspace"),
            remove: () => Promise.reject(new Error("cleanup")),
          },
          extractor: {
            extract: () =>
              Promise.reject(
                new BuildArtifactSnapshotFailedError("/workspace", "primary"),
              ),
          },
          artifactCollector: {
            snapshot: () => Promise.reject("unused"),
            collect: () => Promise.reject("unused"),
          },
          runner: { run: () => Promise.reject("unused") },
          allowBuildNetwork: false,
          limits: TEST_LIMITS,
        }),
      BuildArtifactSnapshotFailedError,
    );
    const input = error.meta?.data.input as { cleanupFailure?: unknown };
    assertEquals(input.cleanupFailure !== undefined, true);
  });
});
