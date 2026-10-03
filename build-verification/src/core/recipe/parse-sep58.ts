import * as ERROR from "@/error/core.ts";
import type {
  ContractBuildRecipe,
  ContractMetadataEntry,
} from "@/core/recipe/types.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const matchesWhole = (pattern: RegExp, value: string): boolean =>
  pattern.exec(value)?.[0] === value;
const SCALAR_KEYS = new Set(["bldimg", "source_uri", "source_sha256"]);
const REGENERATED_KEYS = new Set(["cliver", "rsver", "rssdkver"]);
const RECIPE_KEYS = new Set([...SCALAR_KEYS, "bldarg", "bldopt"]);
const KNOWN_KEYS = new Set([...RECIPE_KEYS, ...REGENERATED_KEYS]);

const validateAscii = (entries: readonly ContractMetadataEntry[]): void => {
  for (const { key, value } of entries) {
    if (
      KNOWN_KEYS.has(key) &&
      [...value].some((character) => character.charCodeAt(0) > 0x7f)
    ) {
      throw new ERROR.InvalidSep58MetadataError(
        key,
        value,
        "SEP-58 values must be ASCII strings.",
      );
    }
  }
};

const scalar = (
  entries: readonly ContractMetadataEntry[],
  key: string,
): string | undefined => {
  const values = entries.filter((entry) => entry.key === key);
  if (values.length > 1) throw new ERROR.DuplicateSep58MetadataError(key);
  return values[0]?.value;
};

/** Converts authoritative metadata into an exact, normalized SEP-58 recipe. */
export const parseSep58Recipe = (
  entries: readonly ContractMetadataEntry[],
): ContractBuildRecipe | null => {
  const hasSep58Metadata = entries.some(({ key }) => RECIPE_KEYS.has(key));
  if (!hasSep58Metadata) return null;

  validateAscii(entries);
  for (const key of SCALAR_KEYS) scalar(entries, key);
  const image = scalar(entries, "bldimg");
  const sourceUri = scalar(entries, "source_uri");
  const sourceSha256 = scalar(entries, "source_sha256");
  if (!image) {
    throw new ERROR.InvalidSep58MetadataError(
      "bldimg",
      image,
      "Strict SEP-58 metadata must include one bldimg value.",
    );
  }
  if (!matchesWhole(IMAGE_PATTERN, image)) {
    throw new ERROR.InvalidSep58MetadataError(
      "bldimg",
      image,
      "bldimg must be a fully qualified sha256 digest reference.",
    );
  }
  if (!sourceSha256 || !matchesWhole(SHA256_PATTERN, sourceSha256)) {
    throw new ERROR.InvalidSep58MetadataError(
      "source_sha256",
      sourceSha256,
      "source_sha256 must be one lowercase 64-character SHA-256 value.",
    );
  }

  const arguments_ = entries.filter(({ key }) => key === "bldarg").map(
    ({ value }) => value,
  );
  if (arguments_.some((value) => !matchesWhole(/^.+$/, value))) {
    throw new ERROR.InvalidSep58MetadataError(
      "bldarg",
      arguments_,
      "bldarg values cannot be empty.",
    );
  }
  const options = entries.filter(({ key }) => key === "bldopt").map(
    ({ value }) => value,
  );
  if (
    options.some((value) =>
      !matchesWhole(/^--[A-Za-z][A-Za-z0-9_-]*(=.+)?$/, value)
    )
  ) {
    throw new ERROR.InvalidSep58MetadataError(
      "bldopt",
      options,
      "Each bldopt must be one complete long-form command-line option.",
    );
  }
  if (
    sourceUri !== undefined &&
    !matchesWhole(/^[a-zA-Z][a-zA-Z0-9+.-]*:\S+$/, sourceUri)
  ) {
    throw new ERROR.InvalidSep58MetadataError(
      "source_uri",
      sourceUri,
      "source_uri must be an absolute URI without whitespace.",
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
