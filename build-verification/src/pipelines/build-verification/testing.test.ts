import type { BuildVerificationPipelineDependencies } from "./types.ts";
import {
  acceptedPolicyDecision,
  TEST_LIMITS,
  TEST_NOW,
  testImageDetails,
  testWasm,
} from "../../testing.test.ts";
import { processSource } from "../../processes/testing.test.ts";

/** Creates complete injected pipeline dependencies without external I/O. */
export const pipelineTestDependencies = (
  overrides: Partial<BuildVerificationPipelineDependencies> = {},
): BuildVerificationPipelineDependencies => ({
  targetResolver: {
    resolve: () =>
      Promise.resolve({
        applicability: "wasm",
        kind: "wasm",
        wasm: testWasm(),
        wasmHash: "target-hash",
        observedAt: TEST_NOW,
      }),
  },
  sourceProvider: { resolve: () => Promise.resolve(processSource()) },
  imageResolver: { resolve: () => Promise.resolve(testImageDetails()) },
  imagePolicy: {
    evaluate: () => Promise.resolve(acceptedPolicyDecision("image")),
  },
  commandPolicy: {
    evaluate: () => Promise.resolve(acceptedPolicyDecision("command")),
  },
  optionPolicy: {
    evaluate: () => Promise.resolve(acceptedPolicyDecision("option")),
  },
  archiveExtractor: {
    extract: () =>
      Promise.resolve({
        sourceDirectory: "/workspace/source",
        files: 1,
        extractedBytes: 8,
      }),
  },
  runner: {
    run: () =>
      Promise.resolve({
        exitCode: 0,
        stdout: "",
        stderr: "",
        durationMs: 1,
        runtimeImageDigest: testImageDetails().manifestDigest,
        runner: { name: "test", version: "1" },
        capabilities: {
          networkIsolation: true,
          readOnlyRootFilesystem: true,
          cpuLimit: true,
          memoryLimit: true,
          pidLimit: true,
          timeout: true,
          hardDiskLimit: false,
        },
      }),
  },
  artifactCollector: {
    snapshot: () => Promise.resolve(new Map()),
    collect: () => {
      const bytes = testWasm();
      return Promise.resolve([{
        path: "/workspace/source/target/wasm32v1-none/release/fixture.wasm",
        bytes,
        size: bytes.length,
        sha256: "artifact-hash",
      }]);
    },
  },
  allowBuildNetwork: false,
  limits: TEST_LIMITS,
  workspace: {
    makeTempDir: () => Promise.resolve("/workspace"),
    remove: () => Promise.resolve(),
  },
  now: () => TEST_NOW,
  ...overrides,
});
