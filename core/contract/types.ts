import type { NetworkConfig } from "@/network/index.ts";
import type { BinaryData } from "@/common/types/index.ts";
import type { Spec } from "stellar-sdk/contract";
import type { Server } from "stellar-sdk/rpc";
import type { ContractErrorMatcherPluginConfig } from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";

/** @internal */
export type ContractConstructorArgs = {
  networkConfig: NetworkConfig;
  contractConfig: ContractConfig;
  rpc?: Server;
};

/** @internal */
export type ContractConfig = {
  /** Contract ABI specification used to encode method arguments and return values. */
  spec?: Spec;
  /** Already-deployed contract id to bind this client to. */
  contractId?: string;
  /** Contract wasm bytes used for upload/deploy flows. */
  wasm?: BinaryData;
  /** Uploaded wasm hash used for deploy flows. */
  wasmHash?: string;
  /**
   * Known contract-error mapping installed on both contract pipelines.
   *
   * Provide this when you want `read(...)` and `invoke(...)` to translate
   * recognized simulation contract errors into
   * `KNOWN_CONTRACT_ERROR_SIMULATION_FAILED` with a human-facing message. A
   * plain map matches by code; an ordered matcher list can match by contract id
   * or by root/sub-invocation level.
   *
   * @example Map known contract errors while constructing a client.
   * ```ts
   * const contract = new Contract({
   *   networkConfig,
   *   contractConfig: {
   *     contractId,
   *     spec,
   *     contractErrors: {
   *       1: { message: "Unauthorized" },
   *     },
   *   },
   * });
   * ```
   */
  contractErrors?: ContractErrorMatcherPluginConfig;
} & (ContractConfigWasm | ContractConfigWasmHash | ContractConfigId);

/** @internal */
export type ContractConfigWasm = {
  wasm: BinaryData;
};

/** @internal */
export type ContractConfigWasmHash = {
  wasmHash: string;
};

/** @internal */
export type ContractConfigId = {
  contractId: string;
};
