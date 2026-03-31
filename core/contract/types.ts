import type { Buffer } from "buffer";
import type { NetworkConfig } from "@/network/index.ts";
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
  wasm?: Buffer;
  wasmHash?: string;
} & (ContractConfigWasm | ContractConfigWasmHash | ContractConfigId);

/** @internal */
export type ContractConfigWasm = {
  wasm: Buffer;
};

/** @internal */
export type ContractConfigWasmHash = {
  wasmHash: string;
};

/** @internal */
export type ContractConfigId = {
  contractId: string;
};
