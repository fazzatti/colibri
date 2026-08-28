import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { ResolvedVerificationSource } from "../../core/types/source.ts";
import {
  MissingVerificationSourceError,
  SourceHashMismatchError,
} from "../../providers/source/error.ts";
import {
  acceptedPolicyDecision,
  TEST_LIMITS,
  TEST_NOW,
} from "../../testing.test.ts";
import {
  completeProcessState,
  processSource,
  recipeProcessState,
} from "../testing.test.ts";
import { ResolveSourceArchiveUnexpectedError } from "./error.ts";
import { resolveSourceArchive } from "./index.ts";

describe("resolveSourceArchive", () => {
  it("passes terminal state through unchanged", async () => {
    const state = completeProcessState();
    assertEquals(
      await resolveSourceArchive({
        state,
        provider: { resolve: () => Promise.reject("unused") },
        limits: TEST_LIMITS,
      }),
      state,
    );
  });

  it("resolves the caller source and retains archive evidence", async () => {
    const calls: unknown[] = [];
    const source = processSource();
    const result = await resolveSourceArchive({
      state: recipeProcessState(),
      provider: {
        resolve: (input) => {
          calls.push(input);
          return Promise.resolve(source);
        },
      },
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(calls, [{
      source: recipeProcessState().value.request.source,
      strict: false,
      limits: TEST_LIMITS,
      provenanceKind: undefined,
    }]);
    assertEquals(result.value.source, source);
    assertEquals(result.evidence.source?.sha256, "source-hash");
    assertEquals(
      result.evidence.source?.policy,
      acceptedPolicyDecision("test.source"),
    );
    assertEquals(result.logs.at(-1)?.code, "BLDV_SOURCE_ARCHIVE_RESOLVED");
  });

  it("derives a strict metadata URL only when no source was supplied", async () => {
    const state = recipeProcessState();
    let observed: unknown;
    const result = await resolveSourceArchive({
      state: recipeProcessState({
        mode: "strictSep58",
        request: { target: state.value.request.target },
        recipe: {
          ...state.value.recipe,
          sourceUri: "https://example.com/source.tar",
        },
      }),
      provider: {
        resolve: (input) => {
          observed = input;
          return Promise.resolve({
            ...processSource(),
            kind: "metadataUrl",
            requestedLocator: "https://example.com/source.tar",
            resolvedLocator: "https://cdn.example.com/source.tar",
            contentType: "application/x-tar",
          } as ResolvedVerificationSource);
        },
      },
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals((observed as { strict: boolean }).strict, true);
    assertEquals(
      (observed as { provenanceKind: string }).provenanceKind,
      "metadataUrl",
    );
    assertEquals((observed as { source: unknown }).source, {
      type: "url",
      url: "https://example.com/source.tar",
    });
    assertEquals(result.state, "active");
    if (result.state === "active") {
      assertEquals(
        result.evidence.source?.resolvedLocator,
        "https://cdn.example.com/source.tar",
      );
    }
  });

  it("records directory sources without inventing archive facts", async () => {
    const result = await resolveSourceArchive({
      state: recipeProcessState(),
      provider: {
        resolve: () =>
          Promise.resolve({
            content: "directory",
            kind: "path",
            path: "/source",
            requestedLocator: "/source",
          }),
      },
      limits: TEST_LIMITS,
      now: () => TEST_NOW,
    });
    assertEquals(result.state, "active");
    if (result.state !== "active") return;
    assertEquals(result.evidence.source, {
      kind: "path",
      content: "directory",
      requestedLocator: "/source",
      resolvedLocator: "/source",
      requestedRevision: undefined,
      resolvedRevision: undefined,
      format: undefined,
      contentType: undefined,
      size: undefined,
      sha256: undefined,
      policy: undefined,
    });
    assertEquals(result.logs.at(-1)?.code, "BLDV_SOURCE_DIRECTORY_RESOLVED");
  });

  it("requires either an explicit source or a metadata source URI", async () => {
    const state = recipeProcessState();
    await assertRejects(
      () =>
        resolveSourceArchive({
          state: recipeProcessState({
            request: { target: state.value.request.target },
            recipe: { ...state.value.recipe, sourceUri: undefined },
          }),
          provider: { resolve: () => Promise.reject("unused") },
          limits: TEST_LIMITS,
        }),
      MissingVerificationSourceError,
    );
  });

  it("checks a recipe source hash before extraction", async () => {
    await assertRejects(
      () =>
        resolveSourceArchive({
          state: recipeProcessState({
            recipe: {
              ...recipeProcessState().value.recipe,
              sourceSha256: "expected",
            },
          }),
          provider: { resolve: () => Promise.resolve(processSource()) },
          limits: TEST_LIMITS,
        }),
      SourceHashMismatchError,
    );
    const result = await resolveSourceArchive({
      state: recipeProcessState({
        recipe: {
          ...recipeProcessState().value.recipe,
          sourceSha256: "source-hash",
        },
      }),
      provider: { resolve: () => Promise.resolve(processSource()) },
      limits: TEST_LIMITS,
    });
    assertEquals(result.state, "active");
  });

  it("normalizes untyped source-provider failures once", async () => {
    await assertRejects(
      () =>
        resolveSourceArchive({
          state: recipeProcessState(),
          provider: { resolve: () => Promise.reject("unexpected") },
          limits: TEST_LIMITS,
        }),
      ResolveSourceArchiveUnexpectedError,
    );
  });
});
