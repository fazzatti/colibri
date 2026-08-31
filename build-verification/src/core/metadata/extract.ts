import { Buffer } from "node:buffer";
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

type XdrReaderLike = {
  readonly eof: boolean;
  read(size: number): Buffer;
  readInt32BE(): number;
  readUInt32BE(): number;
};

class MetadataXdrReader implements XdrReaderLike {
  #offset = 0;
  readonly #bytes: Buffer;

  constructor(bytes: Uint8Array) {
    this.#bytes = Buffer.from(bytes);
  }

  get eof(): boolean {
    return this.#offset === this.#bytes.length;
  }

  #advance(size: number): number {
    const from = this.#offset;
    this.#offset += size;
    if (this.#offset > this.#bytes.length) {
      throw new RangeError("XDR value exceeds metadata section boundary");
    }
    const padding = 4 - (size % 4 || 4);
    for (let index = 0; index < padding; index += 1) {
      if (this.#bytes[this.#offset + index] !== 0) {
        throw new RangeError("XDR metadata contains invalid padding");
      }
    }
    this.#offset += padding;
    return from;
  }

  read(size: number): Buffer {
    const from = this.#advance(size);
    return this.#bytes.subarray(from, from + size);
  }

  readInt32BE(): number {
    return this.#bytes.readInt32BE(this.#advance(4));
  }

  readUInt32BE(): number {
    return this.#bytes.readUInt32BE(this.#advance(4));
  }
}

const decodeMetadataSection = (
  bytes: Uint8Array,
  section: number,
): ContractMetadataEntry[] => {
  const reader = new MetadataXdrReader(bytes);
  const entries: ContractMetadataEntry[] = [];
  try {
    while (!reader.eof) {
      const entry = xdr.ScMetaEntry.read(reader as never);
      entries.push({
        key: entry.value().key().toString(),
        value: entry.value().val().toString(),
      });
    }
    return entries;
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
