import type { NetworkConfig } from "@/network/index.ts";
import type { BinaryData } from "@/common/types/index.ts";
import type { Spec } from "stellar-sdk/contract";
import type { Server } from "stellar-sdk/rpc";
import type { InvokeContractPipeline } from "@/pipelines/invoke-contract/index.ts";
import type { ReadFromContractPipeline } from "@/pipelines/read-from-contract/index.ts";
import type { ContractErrorMatcher } from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import type { ExternalExecutableRef } from "@/common/types/index.ts";
import type {
  ContractExecutableLedgerObservation,
  ContractExecutableView,
} from "@/ledger-entries/types.ts";

/** Provenance of the Wasm/spec most recently loaded successfully from the network. */
export type LoadedContractSnapshot = {
  /** Exact immutable code hash loaded, including when resolved through an external reference. */
  wasmHash: string;
  /** Ledger reported by the RPC response containing the code. */
  observedAtLedger: number;
  /** Deployed contract whose executable was resolved, when applicable. */
  contractId?: string;
  /** Executable selected by the instance/reference lookup. */
  executable: Exclude<ContractExecutableView, { type: "stellarAsset" }>;
  /** Separate instance observation; reads are not an atomic network snapshot. */
  instance?: ContractExecutableLedgerObservation;
  /** Separate external-reference observation, if one was resolved. */
  reference?: ContractExecutableLedgerObservation;
};

/** @internal */
type ContractSpec = Spec;

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
 *
 * This is derived from the contract-error matcher plugin configuration: the
 * loader supplies the `errors` map from the contract WASM/spec, while
 * `contract-id` can omit `contractId` to use the id bound to this client.
 */
export type LoadContractErrorsFromWasmArgs = ContractErrorMatcher extends
  infer Matcher
  ? Matcher extends ContractErrorMatcher
    ? Omit<Matcher, "errors"> extends infer Args
      ? Args extends { strategy: "contract-id"; contractId: unknown }
        ? Omit<Args, "contractId"> & Partial<Pick<Args, "contractId">>
      : Args
    : never
  : never
  : never;

/** @internal */
export type ContractConstructorArgs = {
  networkConfig: NetworkConfig;
  contractConfig: ContractConfig;
  rpc?: Server;
};

/** @internal */
export type ContractConfig =
  & ContractConfigCommon
  & (
    | ContractConfigWasm
    | ContractConfigWasmHash
    | ContractConfigId
    | ContractConfigExternalRef
  );

/** Shared options accepted with every contract source. */
export type ContractConfigCommon = {
  /** Contract ABI specification used to encode method arguments and return values. */
  spec?: ContractSpec;
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
};

/** Contract configuration backed by local Wasm bytes. */
export type ContractConfigWasm = {
  wasm: BinaryData;
  wasmHash?: never;
  contractId?: never;
  externalRef?: never;
};

/** Contract configuration backed by an uploaded Wasm hash. */
export type ContractConfigWasmHash = {
  wasmHash: string;
  wasm?: never;
  contractId?: never;
  externalRef?: never;
};

/** Contract configuration bound to an already-deployed contract. */
export type ContractConfigId = {
  contractId: string;
  wasm?: never;
  wasmHash?: never;
  externalRef?: never;
};

/** Contract configuration backed by a CAP-85 external executable reference. */
export type ContractConfigExternalRef = {
  externalRef: ExternalExecutableRef;
  wasm?: never;
  wasmHash?: never;
  contractId?: never;
};
