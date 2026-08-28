import type { ContractMetadataEntry } from "../recipe/types.ts";

const redactUri = (value: string): string => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|auth|signature|secret/i.test(key)) {
        url.searchParams.set(key, "<redacted>");
      }
    }
    return url.toString();
  } catch {
    return "<invalid-uri>";
  }
};

/** Redacts credential-bearing URI values before metadata enters evidence. */
export const metadataEntriesForEvidence = (
  entries: readonly ContractMetadataEntry[],
): readonly ContractMetadataEntry[] =>
  entries.map(({ key, value }) => ({
    key,
    value: key === "source_uri" ? redactUri(value) : value,
  }));

/** Returns whether ordered metadata contains any SEP-58 recipe field. */
export const hasSep58Metadata = (
  entries: readonly ContractMetadataEntry[],
): boolean =>
  entries.some(({ key }) =>
    key === "bldimg" || key === "bldarg" || key === "bldopt" ||
    key === "source_uri" || key === "source_sha256"
  );
