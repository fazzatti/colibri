import type {
  ActiveVerificationState,
  CompleteVerificationState,
  ContractBuildVerificationInput,
  ContractBuildVerificationMode,
  ResolvedVerificationSource,
} from "@/core/index.ts";
import {
  acceptedPolicyDecision,
  TEST_NOW,
  testEvidence,
  testImageDetails,
  testRecipe,
  testWasm,
} from "@/testing.test.ts";
import type { ResolvedVerificationTargetValue } from "@/processes/resolve-verification-target/types.ts";
import type { ParsedContractMetadataValue } from "@/processes/parse-contract-metadata/types.ts";
import type { ValidatedBuildRecipeValue } from "@/processes/validate-build-recipe/types.ts";
import type { ResolvedSourceArchiveValue } from "@/processes/resolve-source-archive/types.ts";
import type { ResolvedBuildImageValue } from "@/processes/resolve-build-image/types.ts";
import type { ExecutedContractBuildValue } from "@/processes/execute-contract-build/types.ts";
import type { SelectedBuildArtifactValue } from "@/processes/select-build-artifact/types.ts";

/** Deterministic out-of-band request shared by process unit tests. */
export const processRequest = (): ContractBuildVerificationInput => ({
  mode: "outOfBand",
  target: { wasm: testWasm(), label: "fixture" },
  source: {
    type: "archive",
    name: "source.tar",
    bytes: new Uint8Array([1, 2, 3]),
    format: "tar",
  },
  recipe: testRecipe(),
});

/** Resolved source archive shared by process unit tests. */
export const processSource = (): ResolvedVerificationSource => ({
  content: "archive",
  kind: "archive",
  bytes: new Uint8Array([1, 2, 3]),
  name: "source.tar",
  format: "tar",
  requestedLocator: "source.tar",
  size: 3,
  sha256: "source-hash",
  retrievalPolicy: acceptedPolicyDecision("test.source"),
});

const active = <Value>(value: Value): ActiveVerificationState<Value> => ({
  state: "active",
  value,
  evidence: testEvidence(),
  logs: [],
});

/** Active target-resolution state shared by later process tests. */
export const targetProcessState = (
  overrides: Partial<ResolvedVerificationTargetValue> = {},
): ActiveVerificationState<ResolvedVerificationTargetValue> => {
  const request = processRequest();
  return active({
    request,
    mode: "outOfBand" as ContractBuildVerificationMode,
    target: {
      applicability: "wasm",
      kind: "wasm",
      label: "fixture",
      wasm: testWasm(),
      wasmHash: "target-hash",
      observedAt: TEST_NOW,
    },
    ...overrides,
  });
};

/** Active parsed-metadata state shared by later process tests. */
export const metadataProcessState = (
  overrides: Partial<ParsedContractMetadataValue> = {},
): ActiveVerificationState<ParsedContractMetadataValue> =>
  active({
    ...targetProcessState().value,
    metadata: { sections: [], entries: [] },
    ...overrides,
  });

/** Active validated-recipe state shared by later process tests. */
export const recipeProcessState = (
  overrides: Partial<ValidatedBuildRecipeValue> = {},
): ActiveVerificationState<ValidatedBuildRecipeValue> =>
  active({
    ...metadataProcessState().value,
    recipe: testRecipe(),
    ...overrides,
  });

/** Active resolved-source state shared by later process tests. */
export const sourceProcessState = (
  overrides: Partial<ResolvedSourceArchiveValue> = {},
): ActiveVerificationState<ResolvedSourceArchiveValue> =>
  active({
    ...recipeProcessState().value,
    source: processSource(),
    ...overrides,
  });

/** Active resolved-image state shared by later process tests. */
export const imageProcessState = (
  overrides: Partial<ResolvedBuildImageValue> = {},
): ActiveVerificationState<ResolvedBuildImageValue> =>
  active({
    ...sourceProcessState().value,
    image: testImageDetails(),
    imagePolicy: acceptedPolicyDecision("test.image"),
    ...overrides,
  });

/** Active executed-build state shared by later process tests. */
export const executionProcessState = (
  overrides: Partial<ExecutedContractBuildValue> = {},
): ActiveVerificationState<ExecutedContractBuildValue> => {
  const bytes = testWasm();
  return active({
    ...imageProcessState().value,
    buildArguments: ["contract", "build"],
    execution: {
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
    },
    candidates: [{
      path: "/source/target/wasm32v1-none/release/fixture.wasm",
      bytes,
      size: bytes.length,
      sha256: "artifact-hash",
    }],
    ...overrides,
  });
};

/** Active selected-artifact state shared by comparison tests. */
export const artifactProcessState = (
  overrides: Partial<SelectedBuildArtifactValue> = {},
): ActiveVerificationState<SelectedBuildArtifactValue> => {
  const execution = executionProcessState().value;
  return active({
    ...execution,
    artifact: execution.candidates[0],
    ...overrides,
  });
};

/** Terminal state shared by pass-through tests. */
export const completeProcessState = (): CompleteVerificationState => ({
  state: "complete",
  result: {
    status: "notApplicable",
    reason: "stellarAssetContract",
    evidence: testEvidence(),
  },
});
