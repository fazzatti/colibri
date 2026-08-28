import { join, relative, resolve } from "node:path";
import { sha256Hex } from "../core/comparison/compare-wasm.ts";
import type { BuildVerificationLimits } from "../core/types/limits.ts";
import type {
  BuildArtifactCandidate,
  BuildArtifactCollector,
  BuildArtifactSnapshot,
} from "./types.ts";
import {
  ArtifactCollectionFailedError,
  ArtifactLimitExceededError,
  BuildArtifactReadFailedError,
  BuildArtifactSnapshotFailedError,
  UnsafeArtifactPathError,
} from "./error.ts";
import { BuildVerificationError } from "../error/base.ts";

const eligible = (path: string): boolean =>
  /(?:^|\/)(?:wasm32v1-none|wasm32-unknown-unknown)\/[^/]+\/[^/]+\.wasm$/
    .test(path) && !path.includes("/deps/");

/** Rejects a synthetic or filesystem-derived path outside the source root. */
export const assertSafeArtifactRelativePath = (relativePath: string): void => {
  if (
    !relativePath || relativePath.startsWith("../") ||
    relativePath.includes("\0")
  ) {
    throw new UnsafeArtifactPathError(relativePath);
  }
};

const walk = async function* (
  root: string,
  directory = root,
): AsyncGenerator<{ path: string; relativePath: string; symlink: boolean }> {
  const pendingDirectories = [directory];
  while (pendingDirectories.length > 0) {
    const current = pendingDirectories.pop()!;
    for await (const entry of Deno.readDir(current)) {
      const path = resolve(join(current, entry.name));
      const relativePath = relative(root, path).replaceAll("\\", "/");
      assertSafeArtifactRelativePath(relativePath);
      if (entry.isDirectory) {
        pendingDirectories.push(path);
        continue;
      }
      if (!entry.isFile && !entry.isSymlink) continue;
      yield { path, relativePath, symlink: entry.isSymlink };
    }
  }
};

/** Reads and hashes one bounded candidate selected by the filesystem walker. */
export const readBuildArtifactCandidate = async (
  path: string,
  relativePath: string,
  limits: BuildVerificationLimits,
): Promise<BuildArtifactCandidate> => {
  let stat: Deno.FileInfo;
  try {
    stat = await Deno.stat(path);
  } catch (cause) {
    throw new BuildArtifactReadFailedError(relativePath, cause);
  }
  if (stat.size > limits.maxArtifactBytes) {
    throw new ArtifactLimitExceededError(
      relativePath,
      stat.size,
      limits.maxArtifactBytes,
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = await Deno.readFile(path);
  } catch (cause) {
    throw new BuildArtifactReadFailedError(relativePath, cause);
  }
  return {
    path: relativePath,
    bytes,
    size: bytes.length,
    sha256: await sha256Hex(bytes),
  };
};

/** Default filesystem collector for Cargo target Wasm candidates. */
export class DefaultBuildArtifactCollector implements BuildArtifactCollector {
  /** Inventories preexisting candidates without selecting one. */
  async snapshot(
    sourceDirectory: string,
    limits: BuildVerificationLimits,
  ): Promise<BuildArtifactSnapshot> {
    const snapshot = new Map<string, string>();
    try {
      for await (const item of walk(resolve(sourceDirectory))) {
        if (!eligible(item.relativePath)) continue;
        if (item.symlink) throw new UnsafeArtifactPathError(item.relativePath);
        const candidate = await readBuildArtifactCandidate(
          item.path,
          item.relativePath,
          limits,
        );
        snapshot.set(candidate.path, candidate.sha256);
      }
      return snapshot;
    } catch (cause) {
      if (cause instanceof BuildVerificationError) throw cause;
      throw new BuildArtifactSnapshotFailedError(sourceDirectory, cause);
    }
  }

  /** Copies every new or changed candidate into bounded immutable records. */
  async collect(
    sourceDirectory: string,
    before: BuildArtifactSnapshot,
    limits: BuildVerificationLimits,
  ): Promise<readonly BuildArtifactCandidate[]> {
    const candidates: BuildArtifactCandidate[] = [];
    let total = 0;
    try {
      for await (const item of walk(resolve(sourceDirectory))) {
        if (!eligible(item.relativePath)) continue;
        if (item.symlink) throw new UnsafeArtifactPathError(item.relativePath);
        const candidate = await readBuildArtifactCandidate(
          item.path,
          item.relativePath,
          limits,
        );
        if (before.get(candidate.path) === candidate.sha256) continue;
        total += candidate.size;
        if (total > limits.maxArtifactBytes) {
          throw new ArtifactLimitExceededError(
            "<all-candidates>",
            total,
            limits.maxArtifactBytes,
          );
        }
        candidates.push(candidate);
      }
      return candidates;
    } catch (cause) {
      if (cause instanceof BuildVerificationError) throw cause;
      throw new ArtifactCollectionFailedError(sourceDirectory, cause);
    }
  }
}
