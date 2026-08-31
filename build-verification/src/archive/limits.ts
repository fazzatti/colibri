import { ArchiveLimitExceededError } from "@/archive/error.ts";

/** Throws when one measured archive value exceeds its configured maximum. */
export const assertArchiveLimit = (
  limit: string,
  actual: number,
  maximum: number,
): void => {
  if (!Number.isSafeInteger(actual) || actual < 0 || actual > maximum) {
    throw new ArchiveLimitExceededError(limit, actual, maximum);
  }
};
