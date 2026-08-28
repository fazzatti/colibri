import type {
  BuildVerificationLimits,
  ResolvedVerificationSource,
  VerificationArchiveFormat,
} from "../core/types/index.ts";

/** One validated regular-file or directory archive entry. */
export type VerificationArchiveEntry = {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly directory: boolean;
};

/** Input passed to a source archive extractor. */
export type VerificationArchiveExtractorInput = {
  readonly source: ResolvedVerificationSource;
  readonly workspaceDirectory: string;
  readonly limits: BuildVerificationLimits;
};

/** Result of materializing source inside a disposable workspace. */
export type VerificationArchiveExtractorOutput = {
  readonly sourceDirectory: string;
  readonly format?: VerificationArchiveFormat;
  readonly files: number;
  readonly extractedBytes: number;
};

/** Boundary that safely materializes source into an owned workspace. */
export interface VerificationArchiveExtractor {
  /** Extracts or copies source without selecting a build artifact. */
  extract(
    input: VerificationArchiveExtractorInput,
  ): Promise<VerificationArchiveExtractorOutput>;
}
