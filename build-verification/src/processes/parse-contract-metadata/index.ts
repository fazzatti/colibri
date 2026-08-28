import {
  accumulateVerificationEvidence,
} from "../../core/evidence/accumulate.ts";
import {
  extractContractMetadataSections,
  hasSep58Metadata,
  metadataEntriesForEvidence,
} from "../../core/metadata/index.ts";
import { redactContractBuildVerificationInput } from "../../core/types/input.ts";
import {
  completeNotApplicable,
  contextualizeProcessError,
  recordProcessEvent,
} from "../shared.ts";
import { ParseContractMetadataUnexpectedError } from "./error.ts";
import type {
  ParseContractMetadataInput,
  ParseContractMetadataOutput,
} from "./types.ts";

/** Parses ordered contract metadata or completes strict mode when SEP-58 is absent. */
export const parseContractMetadata = async (
  input: ParseContractMetadataInput,
): Promise<ParseContractMetadataOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const metadata = extractContractMetadataSections(
      input.state.value.target.wasm,
    );
    evidence = accumulateVerificationEvidence(evidence, {
      metadata: {
        sectionCount: metadata.sections.length,
        selectedSection: metadata.selectedSection,
        entries: metadataEntriesForEvidence(metadata.entries),
        source: "contractmetav0",
      },
    });
    const sep58 = hasSep58Metadata(metadata.entries);
    logs = await recordProcessEvent(input, logs, {
      stage: "parse-contract-metadata",
      level: sep58 ? "info" : "warning",
      code: sep58 ? "BLDV_METADATA_PARSED" : "BLDV_SEP58_METADATA_MISSING",
      message: sep58
        ? "Decoded ordered contract metadata and found SEP-58 fields."
        : "Decoded contract metadata without SEP-58 build fields.",
      data: { sectionCount: metadata.sections.length },
    });
    if (input.state.value.mode === "strictSep58" && !sep58) {
      return {
        state: "complete",
        result: completeNotApplicable(
          "missingSep58Metadata",
          evidence,
          logs,
          input.state.value.target.wasmHash,
        ),
      };
    }
    return {
      state: "active",
      value: { ...input.state.value, metadata },
      evidence,
      logs,
    };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new ParseContractMetadataUnexpectedError(error),
      {
        input: redactContractBuildVerificationInput(input.state.value.request),
        evidence,
        logs,
      },
    );
  }
};

/** Error constructors emitted by {@link parseContractMetadata}. */
export * from "./error.ts";
/** Process contracts used by {@link parseContractMetadata}. */
export * from "./types.ts";
