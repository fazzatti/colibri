import * as E from "@/contract/error.ts";
import type {
  ContractMetadata,
  InvalidSepClaimReason,
  SepClaimAnalysis,
} from "@/contract/metadata/types.ts";

const parseSepIdentifier = (
  value: string,
): { sep: number } | { reason: InvalidSepClaimReason } => {
  if (value.length === 0) return { reason: "empty" };
  if (!/^[1-9][0-9]*$/.test(value)) {
    return { reason: "invalid-identifier" };
  }

  const sep = Number(value);
  return Number.isSafeInteger(sep) ? { sep } : { reason: "unsafe-identifier" };
};

/**
 * Parses all SEP-47 declarations from previously extracted SEP-46 metadata.
 *
 * SEP-47 declarations may span multiple `sep` entries. Valid occurrences are
 * retained, duplicate numbers are represented in `claims`, and `seps` offers
 * a unique first-seen list. Malformed items remain visible in `invalidClaims`
 * instead of being silently treated as claims.
 */
export const extractSepClaims = (
  metadata: ContractMetadata,
): SepClaimAnalysis => {
  const claims: SepClaimAnalysis["claims"][number][] = [];
  const invalidClaims: SepClaimAnalysis["invalidClaims"][number][] = [];

  for (const entry of metadata.entries) {
    if (entry.key !== "sep") continue;

    for (const [valueIndex, value] of entry.value.split(",").entries()) {
      const parsed = parseSepIdentifier(value);
      if ("sep" in parsed) {
        claims.push({ sep: parsed.sep, valueIndex, metadata: entry });
      } else {
        invalidClaims.push({
          value,
          reason: parsed.reason,
          valueIndex,
          metadata: entry,
        });
      }
    }
  }

  return {
    seps: [...new Set(claims.map(({ sep }) => sep))],
    claims,
    invalidClaims,
  };
};

/** Returns whether a SEP-47 analysis contains the requested SEP claim. */
export const claimsSep = (
  claims: SepClaimAnalysis,
  sep: number,
): boolean => {
  if (!Number.isSafeInteger(sep) || sep <= 0) {
    throw new E.INVALID_SEP_IDENTIFIER(sep);
  }
  return claims.seps.includes(sep);
};
