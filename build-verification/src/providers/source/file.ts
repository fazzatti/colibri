import { resolve } from "node:path";
import {
  ArchiveLimitExceededError,
  UnsafeArchiveEntryError,
} from "@/archive/error.ts";
import { detectArchiveFormat } from "@/archive/detect.ts";
import { sha256Hex } from "@/core/comparison/compare-wasm.ts";
import type { ResolvedVerificationSource } from "@/core/types/index.ts";
import type {
  VerificationSourceProvider,
  VerificationSourceProviderInput,
} from "@/providers/source/types.ts";
import {
  FileSourceProviderInputMismatchError,
  LocalSourceArchiveReadFailedError,
  UnsupportedSourceError,
} from "@/providers/source/error.ts";

/** Provider for local source archives and out-of-band directories. */
export class FileVerificationSourceProvider
  implements VerificationSourceProvider {
  /** Resolves a local path without extracting or mutating the caller's tree. */
  async resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource> {
    if (input.source.type !== "path") {
      throw new FileSourceProviderInputMismatchError(input.source.type);
    }
    const path = resolve(input.source.path);
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.lstat(path);
    } catch (cause) {
      throw new UnsupportedSourceError(
        "The local source path does not exist or cannot be inspected.",
        { path, cause: String(cause) },
      );
    }
    if (stat.isSymlink) {
      throw new UnsafeArchiveEntryError(
        path,
        "The local source root cannot be a symbolic link.",
      );
    }
    if (stat.isDirectory) {
      if (input.strict) {
        throw new UnsupportedSourceError(
          "Strict SEP-58 verification requires exact archive bytes for source_sha256.",
          { path },
        );
      }
      return {
        content: "directory" as const,
        kind: "path" as const,
        path,
        requestedLocator: path,
      };
    }
    if (!stat.isFile) {
      throw new UnsupportedSourceError(
        "Local source paths must be files or directories.",
        {
          path,
        },
      );
    }
    if (stat.size > input.limits.maxArchiveBytes) {
      throw new ArchiveLimitExceededError(
        "archive byte",
        stat.size,
        input.limits.maxArchiveBytes,
      );
    }
    let bytes: Uint8Array;
    try {
      bytes = await Deno.readFile(path);
    } catch (cause) {
      throw new LocalSourceArchiveReadFailedError(path, cause);
    }
    return {
      content: "archive" as const,
      kind: "path" as const,
      bytes,
      name: path,
      format: detectArchiveFormat(path),
      requestedLocator: path,
      resolvedLocator: path,
      size: bytes.length,
      sha256: await sha256Hex(bytes),
    };
  }
}
