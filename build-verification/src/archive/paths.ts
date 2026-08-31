import { posix } from "node:path";
import type { BuildVerificationLimits } from "@/core/types/limits.ts";
import { UnsafeArchiveEntryError } from "@/archive/error.ts";

/** Validates and normalizes one portable archive-relative path. */
export const normalizeArchivePath = (
  path: string,
  limits: BuildVerificationLimits,
): string => {
  if (
    !path || path.includes("\0") || path.includes("\\") ||
    path.length > limits.maxPathLength
  ) {
    throw new UnsafeArchiveEntryError(
      path,
      "Archive paths must be non-empty, portable, and within the path-length limit.",
    );
  }
  if (posix.isAbsolute(path) || path.split("/").includes("..")) {
    throw new UnsafeArchiveEntryError(
      path,
      "Archive paths cannot be absolute or traverse parent directories.",
    );
  }
  const normalized = posix.normalize(path).replace(/^\.\//, "").replace(
    /\/$/,
    "",
  );
  if (!normalized || normalized === "." || normalized.startsWith("../")) {
    throw new UnsafeArchiveEntryError(
      path,
      "Archive path normalization escaped or erased the extraction root.",
    );
  }
  return normalized;
};
