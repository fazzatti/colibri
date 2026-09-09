import { typeName } from "@/generation/type-map.ts";

/** @internal The spec has no contract name; a local filename supplies a useful default. */
export function defaultClassName(wasmPath?: string): string {
  if (!wasmPath) return "ContractClient";
  const stem = wasmPath.split(/[\\/]/).at(-1)!.replace(/\.wasm$/i, "");
  try {
    const name = typeName(stem);
    return ["Contract", "Spec", "ColibriError"].includes(name)
      ? "ContractClient"
      : name;
  } catch {
    return "ContractClient";
  }
}
