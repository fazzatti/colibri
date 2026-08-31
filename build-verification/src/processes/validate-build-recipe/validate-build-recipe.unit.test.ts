import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  CommandPolicyRejectedError,
  OptionPolicyRejectedError,
} from "@/core/policy/error.ts";
import { MissingOutOfBandRecipeError } from "@/error/core.ts";
import {
  acceptedPolicyDecision,
  rejectedPolicyDecision,
  TEST_DIGEST,
  TEST_IMAGE,
  TEST_LIMITS,
  TEST_NOW,
} from "@/testing.test.ts";
import {
  completeProcessState,
  metadataProcessState,
} from "@/processes/testing.test.ts";
import { ValidateBuildRecipeUnexpectedError } from "@/processes/validate-build-recipe/error.ts";
import { validateBuildRecipe } from "@/processes/validate-build-recipe/index.ts";

const acceptedPolicies = () => ({
  commandPolicy: {
    evaluate: () => Promise.resolve(acceptedPolicyDecision("command")),
  },
  optionPolicy: {
    evaluate: () => Promise.resolve(acceptedPolicyDecision("option")),
  },
});

describe("validateBuildRecipe", () => {
  it("passes terminal state through unchanged", async () => {
    const state = completeProcessState();
    assertEquals(
      await validateBuildRecipe({
        state,
        ...acceptedPolicies(),
        limits: TEST_LIMITS,
      }),
      state,
    );
  });

  it("validates an out-of-band recipe and both policies", async () => {
    const calls: unknown[][] = [];
    const result = await validateBuildRecipe({
      state: metadataProcessState(),
      commandPolicy: {
        evaluate: (...args) => {
          calls.push(args);
          return Promise.resolve(acceptedPolicyDecision("command"));
        },
      },
      optionPolicy: {
        evaluate: (...args) => {
          calls.push(args);
          return Promise.resolve(acceptedPolicyDecision("option"));
        },
      },
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.recipe.image, TEST_IMAGE);
    assertEquals(calls, [
      [["contract", "build"]],
      [[], ["contract", "build"]],
    ]);
    assertEquals(result.evidence.recipeProvenance, "callerSupplied");
    assertEquals(result.logs.at(-1)?.code, "BLDV_OUT_OF_BAND_RECIPE_VALIDATED");
  });

  it("parses strict SEP-58 metadata without replacing producer ordering", async () => {
    const entries = [
      { key: "cliver", value: "22.0.0" },
      { key: "bldimg", value: TEST_IMAGE },
      { key: "bldarg", value: "contract" },
      { key: "bldarg", value: "build" },
      { key: "bldopt", value: "--package=fixture" },
      { key: "source_uri", value: "https://user:pass@example.com/source.tar" },
      { key: "source_sha256", value: TEST_DIGEST.slice(7) },
    ];
    const target = metadataProcessState();
    const result = await validateBuildRecipe({
      state: metadataProcessState({
        mode: "strictSep58",
        request: { target: target.value.request.target },
        metadata: {
          sections: [{ index: 0, entries, containsCliVersion: true }],
          selectedSection: 0,
          entries,
        },
      }),
      ...acceptedPolicies(),
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.value.recipe.arguments, ["contract", "build"]);
    assertEquals(result.value.recipe.options, ["--package=fixture"]);
    assertEquals(result.evidence.recipeProvenance, "onChainSep58Metadata");
    assertEquals(
      result.evidence.recipe?.sourceUri,
      "https://example.com/source.tar",
    );
    assertEquals(result.logs.at(-1)?.code, "BLDV_SEP58_RECIPE_VALIDATED");
  });

  it("completes strict mode when no recipe fields remain", async () => {
    const target = metadataProcessState();
    const result = await validateBuildRecipe({
      state: metadataProcessState({
        mode: "strictSep58",
        request: { target: target.value.request.target },
      }),
      ...acceptedPolicies(),
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "complete");
    if (result.state !== "complete") return;
    assertEquals(result.result.reason, "missingSep58Metadata");
    assertEquals(
      result.result.evidence.logs.at(-1)?.code,
      "BLDV_SEP58_RECIPE_MISSING",
    );
  });

  it("rejects a runtime out-of-band request that omits its recipe", async () => {
    const state = metadataProcessState();
    await assertRejects(
      () =>
        validateBuildRecipe({
          state: {
            ...state,
            value: {
              ...state.value,
              request: {
                mode: "outOfBand",
                target: { wasm: new Uint8Array() },
              },
            },
          } as never,
          ...acceptedPolicies(),
          limits: TEST_LIMITS,
        }),
      MissingOutOfBandRecipeError,
    );
  });

  it("maps command and option policy rejection separately", async () => {
    await assertRejects(
      () =>
        validateBuildRecipe({
          state: metadataProcessState(),
          commandPolicy: {
            evaluate: () => Promise.resolve(rejectedPolicyDecision()),
          },
          optionPolicy: acceptedPolicies().optionPolicy,
          limits: TEST_LIMITS,
        }),
      CommandPolicyRejectedError,
    );
    await assertRejects(
      () =>
        validateBuildRecipe({
          state: metadataProcessState(),
          commandPolicy: acceptedPolicies().commandPolicy,
          optionPolicy: {
            evaluate: () => Promise.resolve(rejectedPolicyDecision()),
          },
          limits: TEST_LIMITS,
        }),
      OptionPolicyRejectedError,
    );
  });

  it("normalizes untyped policy failures once", async () => {
    await assertRejects(
      () =>
        validateBuildRecipe({
          state: metadataProcessState(),
          commandPolicy: { evaluate: () => Promise.reject("unexpected") },
          optionPolicy: acceptedPolicies().optionPolicy,
          limits: TEST_LIMITS,
        }),
      ValidateBuildRecipeUnexpectedError,
    );
  });
});
