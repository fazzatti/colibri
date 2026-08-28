import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TEST_LIMITS, TEST_NOW, testWasm } from "../../testing.test.ts";
import { artifactProcessState, completeProcessState } from "../testing.test.ts";
import { CompareContractWasmUnexpectedError } from "./error.ts";
import { compareContractWasm } from "./index.ts";

describe("compareContractWasm", () => {
  it("returns an already completed result unchanged", async () => {
    const state = completeProcessState();
    assertEquals(
      await compareContractWasm({ state, limits: TEST_LIMITS }),
      state.result,
    );
  });

  it("returns verified only for exact raw-byte equality", async () => {
    const wasm = testWasm();
    const state = artifactProcessState({
      target: { ...artifactProcessState().value.target, wasm },
      artifact: {
        ...artifactProcessState().value.artifact,
        bytes: Uint8Array.from(wasm),
        size: wasm.length,
      },
    });
    const result = await compareContractWasm({
      state,
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.status, "verified");
    assertEquals(result.evidence.comparison, {
      equal: true,
      targetLength: wasm.length,
      rebuiltLength: wasm.length,
    });
    assertEquals(result.evidence.observedAt, TEST_NOW);
    assertEquals(result.evidence.logs.at(-1)?.code, "BLDV_WASM_VERIFIED");
  });

  it("returns mismatch without throwing when exact bytes differ", async () => {
    const state = artifactProcessState({
      artifact: {
        ...artifactProcessState().value.artifact,
        bytes: new Uint8Array([1, 2, 3]),
        size: 3,
      },
    });
    const result = await compareContractWasm({
      state,
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.status, "mismatch");
    assertEquals(result.evidence.comparison?.equal, false);
    assertEquals(result.evidence.logs.at(-1)?.level, "warning");
    assertEquals(result.evidence.logs.at(-1)?.code, "BLDV_WASM_MISMATCH");
  });

  it("normalizes failures outside deterministic byte comparison", async () => {
    const state = artifactProcessState();
    const target = Object.defineProperty({}, "wasm", {
      get: () => {
        throw new Error("unexpected getter");
      },
    });
    await assertRejects(
      () =>
        compareContractWasm({
          state: {
            ...state,
            value: { ...state.value, target },
          } as never,
          limits: TEST_LIMITS,
        }),
      CompareContractWasmUnexpectedError,
    );
  });
});
