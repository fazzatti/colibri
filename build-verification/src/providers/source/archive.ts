import { ArchiveLimitExceededError } from "@/archive/error.ts";
import { detectArchiveFormat } from "@/archive/detect.ts";
import { sha256Hex } from "@/core/comparison/compare-wasm.ts";
import type { ResolvedVerificationSource } from "@/core/types/index.ts";
import type {
  VerificationSourceProvider,
  VerificationSourceProviderInput,
} from "@/providers/source/types.ts";

/** Provider for exact in-memory source archive bytes. */
export class ArchiveVerificationSourceProvider
  implements VerificationSourceProvider {
  /** Resolves bounded raw bytes without copying credentials or extracting. */
  async resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource> {
    if (input.source.type !== "archive") {
      throw new TypeError("Archive provider requires an archive source");
    }
    if (input.source.bytes.length > input.limits.maxArchiveBytes) {
      throw new ArchiveLimitExceededError(
        "archive byte",
        input.source.bytes.length,
        input.limits.maxArchiveBytes,
      );
    }
    const bytes = Uint8Array.from(input.source.bytes);
    return {
      content: "archive" as const,
      kind: "archive" as const,
      bytes,
      name: input.source.name,
      format: detectArchiveFormat(input.source.name, input.source.format),
      requestedLocator: input.source.name,
      resolvedLocator: input.source.name,
      size: bytes.length,
      sha256: await sha256Hex(bytes),
    };
  }
}
