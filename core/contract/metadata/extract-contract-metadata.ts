import { xdr } from "stellar-sdk";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import type { BinaryData } from "@/common/types/index.ts";
import * as E from "@/contract/error.ts";
import type {
  ContractMetadata,
  ContractMetadataEntry,
  ContractMetadataSection,
} from "@/contract/metadata/types.ts";

/**
 * Extracts all SEP-46 metadata from contract Wasm.
 *
 * Repeated `contractmetav0` sections and repeated keys are preserved in their
 * original order. Consumers can therefore apply the aggregation rules of the
 * SEP that owns a particular metadata key.
 *
 * @param wasm - Contract Wasm containing zero or more metadata sections.
 * @returns Structured sections and one flattened ordered entry stream.
 */
export const extractContractMetadata = (
  wasm: BinaryData,
): ContractMetadata => {
  let module: WebAssembly.Module;
  try {
    module = new WebAssembly.Module(new Uint8Array(toUint8Array(wasm)));
  } catch (cause) {
    throw new E.INVALID_WASM_FOR_METADATA(cause as Error);
  }

  const sections: ContractMetadataSection[] = WebAssembly.Module
    .customSections(module, "contractmetav0")
    .map((section, sectionIndex) => {
      let decoded: xdr.ScMetaEntry[];
      try {
        decoded = xdr.decodeStream(
          xdr.ScMetaEntry,
          new Uint8Array(section),
        );
      } catch (cause) {
        throw new E.FAILED_TO_DECODE_METADATA_SECTION(
          sectionIndex,
          cause as Error,
        );
      }

      const entries: ContractMetadataEntry[] = decoded.map(
        (entry, entryIndex) => ({
          key: entry.v0.key.toString(),
          value: entry.v0.val.toString(),
          sectionIndex,
          entryIndex,
        }),
      );

      return { index: sectionIndex, entries };
    });

  return {
    sections,
    entries: sections.flatMap(({ entries }) => entries),
  };
};
