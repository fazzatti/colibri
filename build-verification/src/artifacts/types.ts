import type { BuildVerificationLimits } from "@/core/types/limits.ts";

/** Immutable Wasm candidate copied before workspace cleanup. */
export type BuildArtifactCandidate = {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly size: number;
  readonly sha256: string;
};

/** Pre-build hashes used to distinguish newly produced or changed outputs. */
export type BuildArtifactSnapshot = ReadonlyMap<string, string>;

/** Artifact collection boundary kept separate from build execution. */
export interface BuildArtifactCollector {
  /** Inventories eligible artifacts before execution begins. */
  snapshot(
    sourceDirectory: string,
    limits: BuildVerificationLimits,
  ): Promise<BuildArtifactSnapshot>;

  /** Copies all new or changed eligible candidates into immutable records. */
  collect(
    sourceDirectory: string,
    before: BuildArtifactSnapshot,
    limits: BuildVerificationLimits,
  ): Promise<readonly BuildArtifactCandidate[]>;
}
