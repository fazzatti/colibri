import type { NetworkConfig } from "@/network/index.ts";
import type { BinaryData } from "@/common/types/index.ts";
import type { Spec } from "stellar-sdk/contract";
import type { Server } from "stellar-sdk/rpc";

/** @internal */
export type ContractConstructorArgs = {
  networkConfig: NetworkConfig;
  contractConfig: ContractConfig;
  rpc?: Server;
};

/** @internal */
export type ContractConfig = {
  spec?: Spec;
  contractId?: string;
  wasm?: BinaryData;
  wasmHash?: string;
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
