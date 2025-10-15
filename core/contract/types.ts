import type { Buffer } from "node:buffer";
import type { NetworkConfig } from "../network/index.ts";
import type { Spec } from "stellar-sdk/contract";
import type { Server } from "stellar-sdk/rpc";

export type ContractConstructorArgs = {
  networkConfig: NetworkConfig;
  contractConfig: ContractConfig;
  rpc?: Server;
};

export type ContractConfig = {
  spec?: Spec;
  contractId?: string;
  wasm?: Buffer;
  wasmHash?: string;
} & (ContractConfigWasm | ContractConfigWasmHash | ContractConfigId);

export type ContractConfigWasm = {
  wasm: Buffer;
};

export type ContractConfigWasmHash = {
  wasmHash: string;
};

export type ContractConfigId = {
  contractId: string;
};
