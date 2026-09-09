import type { LoadedContractSnapshot, NetworkConfig } from "@colibri/core";
import type { Spec } from "stellar-sdk/contract";
import type { Server } from "stellar-sdk/rpc";

/** Contract ABI source. Network access is only required for deployed sources. */
export type BindingSource =
  | { kind: "wasm"; wasm: Uint8Array }
  | { kind: "spec"; spec: Spec }
  | {
    kind: "contract";
    contractId: string;
    networkConfig: NetworkConfig;
    rpc?: Server;
  }
  | {
    kind: "hash";
    wasmHash: string;
    networkConfig: NetworkConfig;
    rpc?: Server;
  };
/** Immutable source identifiers; endpoint credentials are never generated into code. */
export type BindingProvenance = {
  /** Input category. */
  kind: BindingSource["kind"];
  /** Content hash, when Wasm bytes were available. */
  wasmHash?: string;
  /** Resolved deployment id, when applicable. */
  contractId?: string;
  /** RPC observations; instance/code reads are not an atomic snapshot. */
  snapshot?: LoadedContractSnapshot;
};
/** Loaded spec and its source identifiers. */
export type LoadedBindingSource = { spec: Spec; provenance: BindingProvenance };
/** Portable rendering options. Package presets are registries, not runtime choices. */
export type GenerateBindingsOptions = {
  /** Class name, a valid non-reserved TypeScript identifier. Defaults to ContractClient. */
  className?: string;
  /** Plain source files or a complete package scaffold. Defaults to files. */
  output?: "files" | "package";
  /** Import and package-manifest preset. Defaults to jsr. */
  target?: "jsr" | "npm";
  /** Required for packages. JSR names must be scoped. */
  packageName?: string;
  /** Opt in to source identity in constants.ts and its guide; omitted by default. */
  provenance?: BindingProvenance;
};
/** A deterministic output plan. Rendering never writes files or accesses the network. */
export type GeneratedBindings = {
  /** Replaceable generated files, relative to the output directory. */
  files: Readonly<Record<string, string>>;
  /** Initial scaffold files: writers must preserve existing versions. */
  scaffold: Readonly<Record<string, string>>;
  /** ABI features requiring consumer attention. */
  warnings: readonly string[];
};
