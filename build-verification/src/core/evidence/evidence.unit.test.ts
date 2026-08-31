import { assert, assertEquals, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TEST_NOW, testImageDetails } from "@/testing.test.ts";
import {
  accumulateVerificationEvidence,
  attachVerificationLogs,
  BUILD_VERIFICATION_PACKAGE_VERSION,
  createVerificationEvidence,
} from "@/core/evidence/accumulate.ts";
import {
  finalizeVerificationEvidence,
  imageDetailsForEvidence,
} from "@/core/evidence/finalize.ts";
import { isCompleteVerificationState } from "@/core/types/state.ts";

describe("core verification evidence", () => {
  it("creates and immutably refines the package evidence seed", () => {
    const seed = createVerificationEvidence("strictSep58", TEST_NOW);
    assertEquals(seed.package, {
      name: "@colibri/build-verification",
      version: BUILD_VERIFICATION_PACKAGE_VERSION,
    });
    assert(Object.isFrozen(seed));
    assert(Object.isFrozen(seed.logs));
    const refined = accumulateVerificationEvidence(seed, {
      recipeProvenance: "onChainSep58Metadata",
      observedAt: "later",
    });
    assertEquals(seed.recipeProvenance, undefined);
    assertEquals(refined.recipeProvenance, "onChainSep58Metadata");
    assertEquals(refined.observedAt, "later");
    assert(Object.isFrozen(refined));
  });

  it("attaches exact immutable logs during finalization", () => {
    const seed = createVerificationEvidence("outOfBand", TEST_NOW);
    const event = {
      timestamp: TEST_NOW,
      stage: "compare-contract-wasm" as const,
      level: "info" as const,
      code: "TEST",
      message: "done",
    };
    const attached = attachVerificationLogs(seed, [event]);
    assertEquals(attached.logs, [event]);
    assert(Object.isFrozen(attached.logs));
    assertEquals(finalizeVerificationEvidence(seed, [event]), attached);
  });

  it("retains environment names but never their values", () => {
    const details = imageDetailsForEvidence(testImageDetails({
      environment: ["RUSTUP_TOOLCHAIN=1.88", "EMPTY=", "=bad"],
    }));
    assertEquals(details.environmentVariableNames, [
      "RUSTUP_TOOLCHAIN",
      "EMPTY",
      "<unnamed>",
    ]);
    assertFalse("environment" in details);
  });

  it("narrows active and complete pipeline state", () => {
    const evidence = createVerificationEvidence("strictSep58", TEST_NOW);
    const active = { state: "active" as const, value: 1, evidence, logs: [] };
    const complete = {
      state: "complete" as const,
      result: {
        status: "notApplicable" as const,
        reason: "missingSep58Metadata" as const,
        evidence,
      },
    };
    assertFalse(isCompleteVerificationState(active));
    assert(isCompleteVerificationState(complete));
  });
});
