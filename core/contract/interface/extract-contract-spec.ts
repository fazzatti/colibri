import type { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import { processSpecEntryStream } from "@/common/helpers/wasm.ts";
import type { BinaryData } from "@/common/types/index.ts";
import * as E from "@/contract/error.ts";
import type { ContractSpec } from "@/contract/interface/types.ts";

/** Extracts the SEP-48 contract specification embedded in Wasm. */
export const extractContractSpec = (wasm: BinaryData): ContractSpec => {
  let module: WebAssembly.Module;
  try {
    module = new WebAssembly.Module(new Uint8Array(toUint8Array(wasm)));
  } catch (cause) {
    throw new E.INVALID_WASM_FOR_SPEC(cause as Error);
  }

  const sections = WebAssembly.Module.customSections(module, "contractspecv0");
  if (sections.length === 0) throw new E.MISSING_SPEC_IN_WASM();

  const entries: xdr.ScSpecEntry[] = [];
  for (const [sectionIndex, section] of sections.entries()) {
    try {
      entries.push(...processSpecEntryStream(new Uint8Array(section)));
    } catch (cause) {
      throw new E.FAILED_TO_DECODE_SPEC_SECTION(
        sectionIndex,
        cause as Error,
      );
    }
  }
  return new Spec(entries);
};
