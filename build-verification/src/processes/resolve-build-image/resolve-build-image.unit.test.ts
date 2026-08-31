import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ImagePolicyRejectedError } from "@/core/policy/error.ts";
import { ImageToolchainMissingError } from "@/providers/image/error.ts";
import {
  acceptedPolicyDecision,
  rejectedPolicyDecision,
  TEST_LIMITS,
  TEST_NOW,
  testImageDetails,
} from "@/testing.test.ts";
import {
  completeProcessState,
  sourceProcessState,
} from "@/processes/testing.test.ts";
import { ResolveBuildImageUnexpectedError } from "@/processes/resolve-build-image/error.ts";
import { resolveBuildImage } from "@/processes/resolve-build-image/index.ts";

describe("resolveBuildImage", () => {
  it("passes terminal state through unchanged", async () => {
    const state = completeProcessState();
    assertEquals(
      await resolveBuildImage({
        state,
        resolver: { resolve: () => Promise.reject("unused") },
        policy: { evaluate: () => Promise.reject("unused") },
        limits: TEST_LIMITS,
      }),
      state,
    );
  });

  it("resolves, approves, redacts, and records exact image facts", async () => {
    const image = testImageDetails();
    const decision = {
      ...acceptedPolicyDecision("test.image"),
      warnings: ["unsigned provenance is only an observation"],
    };
    const result = await resolveBuildImage({
      state: sourceProcessState(),
      resolver: {
        resolve: (reference) => {
          assertEquals(reference, sourceProcessState().value.recipe.image);
          return Promise.resolve(image);
        },
      },
      policy: {
        evaluate: (value) => {
          assertEquals(value, image);
          return Promise.resolve(decision);
        },
      },
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.image, image);
    assertEquals(result.value.imagePolicy, decision);
    assertEquals(result.evidence.image?.details.environmentVariableNames, [
      "RUSTUP_TOOLCHAIN",
      "SECRET",
    ]);
    assertEquals(
      "environment" in (result.evidence.image?.details ?? {}),
      false,
    );
    assertEquals(result.logs.at(-1)?.level, "warning");
  });

  it("emits an informational event when image policy has no warnings", async () => {
    const result = await resolveBuildImage({
      state: sourceProcessState(),
      resolver: { resolve: () => Promise.resolve(testImageDetails()) },
      policy: { evaluate: () => Promise.resolve(acceptedPolicyDecision()) },
      limits: TEST_LIMITS,
    });
    assertEquals(
      result.state === "active" && result.logs.at(-1)?.level,
      "info",
    );
  });

  it("records explicit unknown platform values when registry config omits them", async () => {
    const result = await resolveBuildImage({
      state: sourceProcessState(),
      resolver: {
        resolve: () =>
          Promise.resolve(testImageDetails({
            architecture: undefined,
            os: undefined,
          })),
      },
      policy: { evaluate: () => Promise.resolve(acceptedPolicyDecision()) },
      limits: TEST_LIMITS,
    });
    assertEquals(
      result.state === "active" && result.logs.at(-1)?.data?.architecture,
      "unknown",
    );
    assertEquals(
      result.state === "active" && result.logs.at(-1)?.data?.os,
      "unknown",
    );
  });

  it("rejects policy decisions and missing image-pinned toolchains separately", async () => {
    await assertRejects(
      () =>
        resolveBuildImage({
          state: sourceProcessState(),
          resolver: { resolve: () => Promise.resolve(testImageDetails()) },
          policy: { evaluate: () => Promise.resolve(rejectedPolicyDecision()) },
          limits: TEST_LIMITS,
        }),
      ImagePolicyRejectedError,
    );
    await assertRejects(
      () =>
        resolveBuildImage({
          state: sourceProcessState(),
          resolver: {
            resolve: () =>
              Promise.resolve(testImageDetails({
                rustupToolchain: undefined,
              })),
          },
          policy: { evaluate: () => Promise.resolve(acceptedPolicyDecision()) },
          limits: TEST_LIMITS,
        }),
      ImageToolchainMissingError,
    );
  });

  it("uses a stable rejection when a policy supplied no reason", async () => {
    const error = await assertRejects(
      () =>
        resolveBuildImage({
          state: sourceProcessState(),
          resolver: { resolve: () => Promise.resolve(testImageDetails()) },
          policy: {
            evaluate: () =>
              Promise.resolve({
                ...rejectedPolicyDecision(),
                reasons: [],
              }),
          },
          limits: TEST_LIMITS,
        }),
      ImagePolicyRejectedError,
    );
    assertEquals(error.details, "The selected image was rejected.");
  });

  it("normalizes untyped resolver and policy failures once", async () => {
    await assertRejects(
      () =>
        resolveBuildImage({
          state: sourceProcessState(),
          resolver: { resolve: () => Promise.reject("resolver") },
          policy: { evaluate: () => Promise.resolve(acceptedPolicyDecision()) },
          limits: TEST_LIMITS,
        }),
      ResolveBuildImageUnexpectedError,
    );
    await assertRejects(
      () =>
        resolveBuildImage({
          state: sourceProcessState(),
          resolver: { resolve: () => Promise.resolve(testImageDetails()) },
          policy: { evaluate: () => Promise.reject("policy") },
          limits: TEST_LIMITS,
        }),
      ResolveBuildImageUnexpectedError,
    );
  });
});
