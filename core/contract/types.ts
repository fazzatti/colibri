import type { NetworkConfig } from "@/network/index.ts";
import type { BinaryData } from "@/common/types/index.ts";
import type { Spec } from "stellar-sdk/contract";
import type { Server } from "stellar-sdk/rpc";
import type { ContractId } from "@/strkeys/types.ts";
import type { ParsedSimulationErrorIssuer } from "@/common/helpers/contract-error-from-failed-simulation-response.ts";
import type { InvokeContractPipeline } from "@/pipelines/invoke-contract/index.ts";
import type { ReadFromContractPipeline } from "@/pipelines/read-from-contract/index.ts";

/**
 * Plugin accepted by the contract's owned invoke pipeline.
 */
export type ContractInvokePipePlugin = Parameters<
  InvokeContractPipeline["use"]
>[0];

/**
 * Plugin accepted by the contract's owned read pipeline.
 */
export type ContractReadPipePlugin = Parameters<
  ReadFromContractPipeline["use"]
>[0];

/**
 * Plugins attached to the contract's owned pipelines during construction.
 *
 * Constructor-time plugins are intentionally pipeline-specific so callers make
 * a deliberate choice about whether behavior applies to writes, reads, or both.
 */
export type ContractPipelinePlugins = {
  /** Plugins attached to `contract.invokePipe`. */
  invokePipe?: readonly ContractInvokePipePlugin[];
  /** Plugins attached to `contract.readPipe`. */
  readPipe?: readonly ContractReadPipePlugin[];
};

/**
 * Strategy used when deriving contract-error matching from the loaded contract
 * specification.
 */
export type LoadContractErrorsFromWasmArgs =
  | {
    /** Match any parsed contract error by numeric code. */
    strategy: "any";
  }
  | {
    /** Match only errors emitted by a specific contract id. */
    strategy: "contract-id";
    /**
     * Contract id that must emit the error. When omitted, the current
     * contract id bound to this client is used.
     */
    contractId?: ContractId;
  }
  | {
    /** Match only root-invocation or sub-invocation errors. */
    strategy: "issued-from";
    /** Invocation level that must emit the error. */
    issuedFrom: ParsedSimulationErrorIssuer;
  };

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
   * Plugins installed on the contract's owned pipelines during construction.
   *
   * Use this for advanced orchestration that should exist from the moment the
   * client is created. Plugins are split by pipeline so read-only and
   * state-changing flows can be configured independently.
   *
   * @example Attach a plugin to both owned pipelines.
   * ```ts
   * const contract = new Contract({
   *   networkConfig,
   *   contractConfig: {
   *     contractId,
   *     spec,
   *     plugins: {
   *       invokePipe: [plugin],
   *       readPipe: [plugin],
   *     },
   *   },
   * });
   * ```
   */
  plugins?: ContractPipelinePlugins;
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
