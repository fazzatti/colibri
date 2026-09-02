import { accumulateVerificationEvidence } from "@/core/evidence/accumulate.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import type {
  ResolvedVerificationSource,
  VerificationSource,
} from "@/core/types/source.ts";
import {
  MissingVerificationSourceError,
  SourceHashMismatchError,
} from "@/providers/source/error.ts";
import {
  contextualizeProcessError,
  recordProcessEvent,
} from "@/processes/shared.ts";
import { ResolveSourceArchiveUnexpectedError } from "@/processes/resolve-source-archive/error.ts";
import type {
  ResolveSourceArchiveInput,
  ResolveSourceArchiveOutput,
} from "@/processes/resolve-source-archive/types.ts";

const selectVerificationSource = (
  source: VerificationSource | undefined,
  sourceUri: string | undefined,
): { source: VerificationSource; provenanceKind?: "metadataUrl" } => {
  if (source) return { source };
  if (sourceUri) {
    return {
      source: { type: "url", url: sourceUri },
      provenanceKind: "metadataUrl",
    };
  }
  throw new MissingVerificationSourceError();
};

const assertSourceHash = (
  expected: string | undefined,
  source: ResolvedVerificationSource,
): void => {
  if (expected && source.content === "archive" && source.sha256 !== expected) {
    throw new SourceHashMismatchError(expected, source.sha256);
  }
};

const resolvedSourceEvidence = (
  source: ResolvedVerificationSource,
): Parameters<typeof accumulateVerificationEvidence>[1] => ({
  source: {
    kind: source.kind,
    content: source.content,
    requestedLocator: source.requestedLocator,
    resolvedLocator: source.content === "archive"
      ? source.resolvedLocator
      : source.requestedLocator,
    requestedRevision: source.content === "archive"
      ? source.requestedRevision
      : undefined,
    resolvedRevision: source.content === "archive"
      ? source.resolvedRevision
      : undefined,
    format: source.content === "archive" ? source.format : undefined,
    contentType: source.content === "archive" ? source.contentType : undefined,
    size: source.content === "archive" ? source.size : undefined,
    sha256: source.content === "archive" ? source.sha256 : undefined,
    policy: source.content === "archive" ? source.retrievalPolicy : undefined,
  },
});

const sourceResolutionEvent = (source: ResolvedVerificationSource) => ({
  stage: "resolve-source-archive" as const,
  level: "info" as const,
  code: source.content === "archive"
    ? "BLDV_SOURCE_ARCHIVE_RESOLVED"
    : "BLDV_SOURCE_DIRECTORY_RESOLVED",
  message: source.content === "archive"
    ? "Resolved and authenticated exact source archive bytes."
    : "Resolved an out-of-band local source directory.",
  data: source.content === "archive"
    ? { size: source.size, sha256: source.sha256 }
    : undefined,
});

/** Resolves bounded exact source bytes and checks the pre-extraction hash. */
export const resolveSourceArchive = async (
  input: ResolveSourceArchiveInput,
): Promise<ResolveSourceArchiveOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const { request, mode, recipe } = input.state.value;
    const { source, provenanceKind } = selectVerificationSource(
      request.source,
      recipe.sourceUri,
    );
    const resolved = await input.provider.resolve({
      source,
      strict: mode === "strictSep58",
      limits: input.limits,
      provenanceKind,
    });
    assertSourceHash(recipe.sourceSha256, resolved);
    evidence = accumulateVerificationEvidence(
      evidence,
      resolvedSourceEvidence(resolved),
    );
    logs = await recordProcessEvent(
      input,
      logs,
      sourceResolutionEvent(resolved),
    );
    return {
      state: "active",
      value: { ...input.state.value, source: resolved },
      evidence,
      logs,
    };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new ResolveSourceArchiveUnexpectedError(error),
      {
        input: redactContractBuildVerificationInput(input.state.value.request),
        evidence,
        logs,
      },
    );
  }
};

/** Error constructors emitted by {@link resolveSourceArchive}. */
export * from "@/processes/resolve-source-archive/error.ts";
/** Process contracts used by {@link resolveSourceArchive}. */
export * from "@/processes/resolve-source-archive/types.ts";
