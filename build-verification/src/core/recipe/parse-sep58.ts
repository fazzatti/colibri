import {
  DuplicateSep58MetadataError,
  InvalidSep58MetadataError,
} from "@/error/core.ts";
import type {
  ContractBuildRecipe,
  ContractMetadataEntry,
} from "@/core/recipe/types.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SCALAR_KEYS = new Set(["bldimg", "source_uri", "source_sha256"]);
const REGENERATED_KEYS = new Set(["cliver", "rsver", "rssdkver"]);

const scalar = (
  entries: readonly ContractMetadataEntry[],
  key: string,
): string | undefined => {
  const values = entries.filter((entry) => entry.key === key);
  if (values.length > 1) throw new DuplicateSep58MetadataError(key);
  return values[0]?.value;
};

/** Converts authoritative metadata into an exact, normalized SEP-58 recipe. */
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

  const arguments_ = entries.filter(({ key }) => key === "bldarg").map(
    ({ value }) => value,
  );
  if (arguments_.some((value) => value.length === 0)) {
    throw new InvalidSep58MetadataError(
      "bldarg",
      arguments_,
      "bldarg values cannot be empty.",
    );
  }
  const options = entries.filter(({ key }) => key === "bldopt").map(
    ({ value }) => value,
  );
  if (options.some((value) => value.length === 0 || !value.startsWith("--"))) {
    throw new InvalidSep58MetadataError(
      "bldopt",
      options,
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
