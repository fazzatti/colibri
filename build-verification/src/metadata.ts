import { Buffer } from "node:buffer";
import { xdr } from "stellar-sdk";
import {
  DuplicateSep58MetadataError,
  InvalidSep58MetadataError,
  InvalidTargetWasmError,
  MetadataDecodingFailedError,
} from "@/error.ts";
import type { ContractBuildRecipe, ContractMetadataEntry } from "@/types.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const BUILD_OPTION_PATTERN = /^--[A-Za-z][A-Za-z0-9_-]*(=.+)?$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SCALAR_KEYS = new Set(["bldimg", "source_uri", "source_sha256"]);
const REGENERATED_KEYS = new Set(["cliver", "rsver", "rssdkver"]);

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

/** Extracts the authoritative Stellar CLI metadata section from contract wasm. */
export const extractContractMetadata = (
  wasm: Uint8Array,
): readonly ContractMetadataEntry[] => {
  let module: WebAssembly.Module;
  try {
    module = new WebAssembly.Module(Uint8Array.from(wasm));
  } catch (cause) {
    throw new InvalidTargetWasmError(cause);
  }

  const sections = WebAssembly.Module.customSections(module, "contractmetav0")
    .map((section, index) =>
      decodeMetadataSection(new Uint8Array(section), index)
    )
    .filter((entries) => entries.length > 0);
  const cliSection = sections.find((entries) =>
    entries.some(({ key }) => key === "cliver")
  );
  return cliSection ?? sections.at(-1) ?? [];
};

const scalar = (
  entries: readonly ContractMetadataEntry[],
  key: string,
): string | undefined => {
  const values = entries.filter((entry) => entry.key === key);
  if (values.length > 1) throw new DuplicateSep58MetadataError(key);
  return values[0]?.value;
};

/** Converts authoritative metadata entries into a validated SEP-58 build recipe. */
export const parseSep58Recipe = (
  entries: readonly ContractMetadataEntry[],
): ContractBuildRecipe | null => {
  const hasSep58Metadata = entries.some(({ key }) =>
    key === "bldimg" || key === "bldarg" || key === "bldopt" ||
    key === "source_uri" || key === "source_sha256"
  );
  if (!hasSep58Metadata) return null;

  for (const key of SCALAR_KEYS) scalar(entries, key);
  const image = scalar(entries, "bldimg");
  const sourceUri = scalar(entries, "source_uri");
  const sourceSha256 = scalar(entries, "source_sha256");
  if (!image) {
    throw new InvalidSep58MetadataError(
      "bldimg",
      image,
      "Strict SEP-58 metadata must include one bldimg value.",
    );
  }
  if (!IMAGE_PATTERN.test(image)) {
    throw new InvalidSep58MetadataError(
      "bldimg",
      image,
      "bldimg must be a fully qualified sha256 digest reference.",
    );
  }
  if (!sourceSha256 || !SHA256_PATTERN.test(sourceSha256)) {
    throw new InvalidSep58MetadataError(
      "source_sha256",
      sourceSha256,
      "source_sha256 must be one lowercase 64-character SHA-256 value.",
    );
  }

  const arguments_ = entries.filter(({ key }) => key === "bldarg").map((
    { value },
  ) => value);
  if (arguments_.some((value) => value.length === 0)) {
    throw new InvalidSep58MetadataError(
      "bldarg",
      arguments_,
      "bldarg values cannot be empty.",
    );
  }
  const options = entries.filter(({ key }) => key === "bldopt").map((
    { value },
  ) => value);
  const invalidOption = options.find((value) =>
    !BUILD_OPTION_PATTERN.test(value)
  );
  if (invalidOption) {
    throw new InvalidSep58MetadataError(
      "bldopt",
      invalidOption,
      "Each bldopt must be one complete long-form command-line option.",
    );
  }

  return {
    image,
    arguments: arguments_.length > 0 ? arguments_ : ["contract", "build"],
    options,
    metadata: entries.filter(({ key }) => !REGENERATED_KEYS.has(key)),
    sourceUri,
    sourceSha256,
  };
};

/** Builds and validates the explicitly caller-supplied out-of-band recipe. */
export const parseOutOfBandRecipe = (
  recipe: {
    readonly image: string;
    readonly arguments?: readonly string[];
    readonly options?: readonly string[];
    readonly metadata?: readonly ContractMetadataEntry[];
    readonly sourceSha256?: string;
  },
): ContractBuildRecipe => {
  if (!IMAGE_PATTERN.test(recipe.image)) {
    throw new InvalidSep58MetadataError(
      "image",
      recipe.image,
      "The out-of-band image must be a fully qualified sha256 digest reference.",
    );
  }
  const arguments_ = recipe.arguments ?? ["contract", "build"];
  if (
    arguments_.length === 0 || arguments_.some((value) => value.length === 0)
  ) {
    throw new InvalidSep58MetadataError(
      "arguments",
      arguments_,
      "The out-of-band build command must contain non-empty arguments.",
    );
  }
  const options = recipe.options ?? [];
  const invalidOption = options.find((value) =>
    !BUILD_OPTION_PATTERN.test(value)
  );
  if (invalidOption) {
    throw new InvalidSep58MetadataError(
      "options",
      invalidOption,
      "Each out-of-band build option must be one complete long-form option.",
    );
  }
  if (recipe.sourceSha256 && !SHA256_PATTERN.test(recipe.sourceSha256)) {
    throw new InvalidSep58MetadataError(
      "sourceSha256",
      recipe.sourceSha256,
      "sourceSha256 must be a lowercase 64-character SHA-256 value.",
    );
  }
  return {
    image: recipe.image,
    arguments: [...arguments_],
    options: [...options],
    metadata: [...(recipe.metadata ?? [])],
    sourceSha256: recipe.sourceSha256,
  };
};
