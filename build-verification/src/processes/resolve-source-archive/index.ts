import { accumulateVerificationEvidence } from "@/core/evidence/accumulate.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import type { VerificationSource } from "@/core/types/source.ts";
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

/** Resolves bounded exact source bytes and checks the pre-extraction hash. */
export const resolveSourceArchive = async (
  input: ResolveSourceArchiveInput,
): Promise<ResolveSourceArchiveOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const { request, mode, recipe } = input.state.value;
    let source: VerificationSource | undefined = request.source;
    let provenanceKind: "metadataUrl" | undefined;
    if (!source && recipe.sourceUri) {
      source = { type: "url", url: recipe.sourceUri };
      provenanceKind = "metadataUrl";
    }
    if (!source) throw new MissingVerificationSourceError();
    const resolved = await input.provider.resolve({
      source,
      strict: mode === "strictSep58",
      limits: input.limits,
      provenanceKind,
    });
    if (
      recipe.sourceSha256 && resolved.content === "archive" &&
      resolved.sha256 !== recipe.sourceSha256
    ) {
      throw new SourceHashMismatchError(recipe.sourceSha256, resolved.sha256);
    }
    evidence = accumulateVerificationEvidence(evidence, {
      source: {
        kind: resolved.kind,
        content: resolved.content,
        requestedLocator: resolved.requestedLocator,
        resolvedLocator: resolved.content === "archive"
          ? resolved.resolvedLocator
          : resolved.requestedLocator,
        requestedRevision: resolved.content === "archive"
          ? resolved.requestedRevision
          : undefined,
        resolvedRevision: resolved.content === "archive"
          ? resolved.resolvedRevision
          : undefined,
        format: resolved.content === "archive" ? resolved.format : undefined,
        contentType: resolved.content === "archive"
          ? resolved.contentType
          : undefined,
        size: resolved.content === "archive" ? resolved.size : undefined,
        sha256: resolved.content === "archive" ? resolved.sha256 : undefined,
        policy: resolved.content === "archive"
          ? resolved.retrievalPolicy
          : undefined,
      },
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "resolve-source-archive",
      level: "info",
      code: resolved.content === "archive"
        ? "BLDV_SOURCE_ARCHIVE_RESOLVED"
        : "BLDV_SOURCE_DIRECTORY_RESOLVED",
      message: resolved.content === "archive"
        ? "Resolved and authenticated exact source archive bytes."
        : "Resolved an out-of-band local source directory.",
      data: resolved.content === "archive"
        ? { size: resolved.size, sha256: resolved.sha256 }
        : undefined,
    });
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
