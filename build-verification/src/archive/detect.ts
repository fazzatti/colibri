import { UnsupportedArchiveError } from "@/archive/error.ts";
import type { VerificationArchiveFormat } from "@/core/types/source.ts";

/** Detects a supported archive format from an explicit hint or stable name. */
export const detectArchiveFormat = (
  name: string,
  explicit?: VerificationArchiveFormat,
): VerificationArchiveFormat => {
  if (explicit) return explicit;
  const lower = name.toLowerCase().split(/[?#]/, 1)[0];
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tarGzip";
  if (lower.endsWith(".tar")) return "tar";
  if (lower.endsWith(".zip")) return "zip";
  throw new UnsupportedArchiveError(name);
};
