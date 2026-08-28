import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { InvalidVerificationInputError } from "../../error/core.ts";
import { MissingTargetNetworkError } from "../../providers/target/error.ts";
import { processRequest } from "../testing.test.ts";
import { TEST_LIMITS, TEST_NOW, testWasm } from "../../testing.test.ts";
import { resolveVerificationTarget } from "./index.ts";
import { ResolveVerificationTargetUnexpectedError } from "./error.ts";

describe("resolveVerificationTarget", () => {
  it("resolves exact Wasm facts and seeds network evidence and logs", async () => {
    const networkEvidence = {
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://rpc.example",
      allowHttp: false,
      input: "rpcUrl" as const,
    };
    const result = await resolveVerificationTarget({
      request: processRequest(),
      resolver: {
        resolve: () =>
          Promise.resolve({
            applicability: "wasm",
            kind: "wasm",
            label: "fixture",
            wasm: testWasm(),
            wasmHash: "target-hash",
            lastModifiedLedgerSeq: 123,
            observedAt: TEST_NOW,
          }),
      },
      networkEvidence,
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.mode, "outOfBand");
    assertEquals(result.evidence.network, networkEvidence);
    assertEquals(result.evidence.target?.wasmHash, "target-hash");
    assertEquals(result.logs.map(({ code }) => code), [
      "BLDV_TARGET_RESOLUTION_STARTED",
      "BLDV_TARGET_RESOLVED",
    ]);
  });

  it("completes as not applicable for a Stellar Asset Contract", async () => {
    const result = await resolveVerificationTarget({
      request: {
        target: {
          contractId:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        },
      },
      resolver: {
        resolve: () =>
          Promise.resolve({
            applicability: "stellarAssetContract",
            kind: "contractId",
            contractId:
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
            observedAt: TEST_NOW,
          }),
      },
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "complete");
    if (result.state !== "complete") return;
    assertEquals(result.result.status, "notApplicable");
    assertEquals(result.result.reason, "stellarAssetContract");
    assertEquals(
      result.result.evidence.logs.at(-1)?.code,
      "BLDV_TARGET_IS_SAC",
    );
  });

  it("rejects invalid runtime input before calling a provider", async () => {
    let called = false;
    await assertRejects(
      () =>
        resolveVerificationTarget({
          request: { mode: "outOfBand", target: { wasm: testWasm() } } as never,
          resolver: {
            resolve: () => {
              called = true;
              throw new Error("must not run");
            },
          },
          limits: TEST_LIMITS,
        }),
      InvalidVerificationInputError,
    );
    assertEquals(called, false);
  });

  it("preserves typed provider errors and adds process context", async () => {
    const error = await assertRejects(
      () =>
        resolveVerificationTarget({
          request: processRequest(),
          resolver: {
            resolve: () => Promise.reject(new MissingTargetNetworkError()),
          },
          limits: TEST_LIMITS,
          now: () => TEST_NOW,
        }),
      MissingTargetNetworkError,
    );
    assertEquals(error.meta?.data.evidence !== undefined, true);
    assertEquals(Array.isArray(error.meta?.data.logs), true);
  });

  it("normalizes untyped provider failures once", async () => {
    await assertRejects(
      () =>
        resolveVerificationTarget({
          request: processRequest(),
          resolver: { resolve: () => Promise.reject("unexpected") },
          limits: TEST_LIMITS,
          now: () => TEST_NOW,
        }),
      ResolveVerificationTargetUnexpectedError,
    );
  });
});
