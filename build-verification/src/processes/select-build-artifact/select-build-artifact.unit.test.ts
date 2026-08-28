import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  BuildArtifactAmbiguousError,
  BuildArtifactNotFoundError,
} from "../../artifacts/error.ts";
import { TEST_LIMITS, TEST_NOW, testWasm } from "../../testing.test.ts";
import {
  completeProcessState,
  executionProcessState,
} from "../testing.test.ts";
import { SelectBuildArtifactUnexpectedError } from "./error.ts";
import { selectBuildArtifact } from "./index.ts";

const artifact = (path: string) => {
  const bytes = testWasm();
  return { path, bytes, size: bytes.length, sha256: path };
};

describe("selectBuildArtifact", () => {
  it("passes terminal state through unchanged", async () => {
    const state = completeProcessState();
    assertEquals(
      await selectBuildArtifact({ state, limits: TEST_LIMITS }),
      state,
    );
  });

  it("selects one exact package/profile candidate and records byte-free evidence", async () => {
    const selected = artifact(
      "/source/target/wasm32v1-none/release/my_contract.wasm",
    );
    const result = await selectBuildArtifact({
      state: executionProcessState({
        recipe: {
          ...executionProcessState().value.recipe,
          options: ["--package=my-contract", "--profile=release"],
        },
        candidates: [
          artifact("/source/target/wasm32v1-none/debug/my_contract.wasm"),
          selected,
        ],
      }),
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.artifact, selected);
    assertEquals(result.evidence.artifact, {
      path: selected.path,
      size: selected.size,
      sha256: selected.sha256,
    });
    assertEquals(result.logs.at(-1)?.code, "BLDV_BUILD_ARTIFACT_SELECTED");
  });

  it("keeps missing and ambiguous artifact occurrences distinct", async () => {
    await assertRejects(
      () =>
        selectBuildArtifact({
          state: executionProcessState({ candidates: [] }),
          limits: TEST_LIMITS,
        }),
      BuildArtifactNotFoundError,
    );
    const candidates = [
      artifact("/a/release/first.wasm"),
      artifact("/b/release/second.wasm"),
    ];
    await assertRejects(
      () =>
        selectBuildArtifact({
          state: executionProcessState({ candidates }),
          limits: TEST_LIMITS,
        }),
      BuildArtifactAmbiguousError,
    );
  });

  it("normalizes failures outside the selector contract", async () => {
    const throwingCandidate = Object.defineProperty({}, "path", {
      get: () => {
        throw new Error("unexpected getter");
      },
    });
    await assertRejects(
      () =>
        selectBuildArtifact({
          state: executionProcessState({
            candidates: [throwingCandidate] as never,
          }),
          limits: TEST_LIMITS,
        }),
      SelectBuildArtifactUnexpectedError,
    );
  });
});
