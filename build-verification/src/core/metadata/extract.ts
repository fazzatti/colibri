import { xdr } from "stellar-sdk";
import {
  InvalidTargetWasmError,
  MetadataDecodingFailedError,
} from "@/error/core.ts";
import type { ContractMetadataEntry } from "@/core/recipe/types.ts";
import type {
  ContractMetadataSection,
  ExtractedContractMetadata,
} from "@/core/metadata/types.ts";

const decodeMetadataSection = (
  bytes: Uint8Array,
  section: number,
): ContractMetadataEntry[] => {
  try {
    return xdr.decodeStream(xdr.ScMetaEntry, bytes).map((entry) => ({
      key: entry.v0.key.toString(),
      value: entry.v0.val.toString(),
    }));
  } catch (cause) {
    throw new MetadataDecodingFailedError(section, cause);
  }
};

/** Enumerates and decodes every non-empty `contractmetav0` section. */
export const extractContractMetadataSections = (
  wasm: Uint8Array,
): ExtractedContractMetadata => {
  let module: WebAssembly.Module;
  try {
    module = new WebAssembly.Module(Uint8Array.from(wasm));
  } catch (cause) {
    throw new InvalidTargetWasmError(cause);
  }

  const sections: ContractMetadataSection[] = WebAssembly.Module.customSections(
    module,
    "contractmetav0",
  ).map((section, index) => {
    const entries = decodeMetadataSection(new Uint8Array(section), index);
    return {
      index,
      entries,
      containsCliVersion: entries.some(({ key }) => key === "cliver"),
    };
  }).filter(({ entries }) => entries.length > 0);

  const selected =
    sections.find(({ containsCliVersion }) => containsCliVersion) ??
      sections.at(-1);
  return {
    sections,
    selectedSection: selected?.index,
    entries: selected?.entries ?? [],
  };
};

/** Extracts ordered entries from the authoritative contract metadata section. */
export const extractContractMetadata = (
  wasm: Uint8Array,
): readonly ContractMetadataEntry[] =>
  extractContractMetadataSections(wasm).entries;
