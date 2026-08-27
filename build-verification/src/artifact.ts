import { relative, resolve } from "node:path";
import {
  BuildArtifactAmbiguousError,
  BuildArtifactNotFoundError,
  BuildArtifactReadFailedError,
  BuildArtifactSnapshotFailedError,
} from "@/error.ts";
import { sha256Hex } from "@/hash.ts";

type WasmSnapshot = Map<string, string>;

const walk = async function* (directory: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(directory)) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory) yield* walk(path);
    else if (entry.isFile && entry.name.endsWith(".wasm")) yield path;
  }
};

const eligible = (root: string, path: string): boolean => {
  const normalized = relative(root, path).replaceAll("\\", "/");
  return /(?:^|\/)(?:wasm32v1-none|wasm32-unknown-unknown)\/release\/[^/]+\.wasm$/
    .test(normalized) &&
    !normalized.includes("/release/deps/");
};

/** Captures hashes of eligible wasm files present before a build begins. */
export const snapshotBuildArtifacts = async (
  root: string,
): Promise<WasmSnapshot> => {
  const snapshot: WasmSnapshot = new Map();
  try {
    for await (const path of walk(root)) {
      if (eligible(root, path)) {
        snapshot.set(path, await sha256Hex(await Deno.readFile(path)));
      }
    }
  } catch (cause) {
    throw new BuildArtifactSnapshotFailedError(root, cause);
  }
  return snapshot;
};

/** Selects one new or changed Cargo release wasm without guessing. */
export const selectBuildArtifact = async (
  root: string,
  before: WasmSnapshot,
  options: readonly string[],
): Promise<{ path: string; wasm: Uint8Array }> => {
  const candidates: { path: string; wasm: Uint8Array }[] = [];
  try {
    for await (const path of walk(root)) {
      if (!eligible(root, path)) continue;
      const wasm = await Deno.readFile(path);
      if (before.get(path) !== await sha256Hex(wasm)) {
        candidates.push({ path, wasm });
      }
    }
  } catch (cause) {
    throw new BuildArtifactReadFailedError(root, cause);
  }

  const packageOption = options.find((option) =>
    option.startsWith("--package=")
  );
  const packageName = packageOption?.slice("--package=".length).replaceAll(
    "-",
    "_",
  );
  const selected = packageName
    ? candidates.filter(({ path }) => path.endsWith(`/${packageName}.wasm`))
    : candidates;
  if (selected.length === 0) throw new BuildArtifactNotFoundError();
  if (selected.length > 1) {
    throw new BuildArtifactAmbiguousError(selected.map(({ path }) => path));
  }
  return selected[0];
};
