import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { InvalidTargetWasmError } from "../../error/core.ts";
import { completeProcessState, targetProcessState } from "../testing.test.ts";
import {
  TEST_LIMITS,
  TEST_NOW,
  testWasm,
  testWasmWithMetadata,
} from "../../testing.test.ts";
import { ParseContractMetadataUnexpectedError } from "./error.ts";
import { parseContractMetadata } from "./index.ts";

describe("parseContractMetadata", () => {
  it("passes terminal state through unchanged", async () => {
    const state = completeProcessState();
    assertEquals(
      await parseContractMetadata({ state, limits: TEST_LIMITS }),
      state,
    );
  });

  it("extracts ordered SEP-58 metadata and remains active", async () => {
    const wasm = testWasmWithMetadata([
      { key: "cliver", value: "22.0.0" },
      { key: "bldimg", value: "docker.io/example@sha256:abc" },
      { key: "bldarg", value: "contract" },
    ]);
    const result = await parseContractMetadata({
      state: targetProcessState({
        mode: "strictSep58",
        request: { target: { wasm } },
        target: {
          applicability: "wasm",
          kind: "wasm",
          wasm,
          wasmHash: "target-hash",
          observedAt: TEST_NOW,
        },
      }),
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.metadata.entries.map(({ key }) => key), [
      "cliver",
      "bldimg",
      "bldarg",
    ]);
    assertEquals(result.evidence.metadata?.sectionCount, 1);
    assertEquals(result.logs.at(-1)?.code, "BLDV_METADATA_PARSED");
  });

  it("completes strict verification when SEP-58 metadata is absent", async () => {
    const result = await parseContractMetadata({
      state: targetProcessState({
        mode: "strictSep58",
        request: { target: { wasm: testWasm() } },
      }),
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "complete");
    if (result.state !== "complete") return;
    assertEquals(result.result.reason, "missingSep58Metadata");
    assertEquals(result.result.targetWasmHash, "target-hash");
    assertEquals(
      result.result.evidence.logs.at(-1)?.code,
      "BLDV_SEP58_METADATA_MISSING",
    );
  });

  it("keeps out-of-band verification active without SEP-58 fields", async () => {
    const result = await parseContractMetadata({
      state: targetProcessState(),
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.metadata.entries, []);
    assertEquals(result.logs.at(-1)?.level, "warning");
  });

  it("preserves typed invalid-Wasm errors with accumulated context", async () => {
    const error = await assertRejects(
      () =>
        parseContractMetadata({
          state: targetProcessState({
            target: {
              applicability: "wasm",
              kind: "wasm",
              wasm: new Uint8Array([1]),
              wasmHash: "invalid",
              observedAt: TEST_NOW,
            },
          }),
          limits: TEST_LIMITS,
        }),
      InvalidTargetWasmError,
    );
    assertEquals(error.meta?.data.evidence !== undefined, true);
  });

  it("normalizes failures outside the metadata core contract", async () => {
    const state = targetProcessState();
    const throwingTarget = Object.defineProperty({}, "wasm", {
      get: () => {
        throw new Error("unexpected getter");
      },
    });
    await assertRejects(
      () =>
        parseContractMetadata({
          state: {
            ...state,
            value: { ...state.value, target: throwingTarget },
          } as never,
          limits: TEST_LIMITS,
        }),
      ParseContractMetadataUnexpectedError,
    );
  });
});
