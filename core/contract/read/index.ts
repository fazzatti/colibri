import { Operation } from "stellar-sdk/base";
import type { Server as NativeServer } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";
import type { ContractId } from "@/strkeys/types.ts";
import type { Spec } from "@/contract/spec.ts";
import {
  decodeSorobanResult,
  encodeSorobanArguments,
} from "@/contract/encoding/index.ts";
import {
  createReadFromContractPipeline,
  type ReadFromContractPipeline,
} from "@/pipelines/read-from-contract/index.ts";

/** @internal Native RPC client, retained unchanged. */
type ReadRpc = NativeServer;

/** A simulation request using an existing spec, without a full Contract instance. */
export interface ContractReadRequest {
  /** Network for the simulation. */
  networkConfig: NetworkConfig;
  /** Deployed contract. */
  contractId: ContractId;
  /** Loaded canonical contract spec. */
  spec: Spec;
  /** Exact ABI method name. */
  method: string;
  /** Named arguments; omitted for argument-free functions. */
  methodArgs?: object;
  /** Optional existing RPC instance. */
  rpc?: ReadRpc;
  /** Optional existing read pipeline, including caller-installed plugins. */
  pipeline?: ReadFromContractPipeline;
}
/** Simulate and decode through the same read pipeline and codecs as Contract.read. */
export async function readContract(
  request: ContractReadRequest,
): Promise<unknown> {
  const { spec, method, methodArgs } = request;
  const operation = Operation.invokeContractFunction({
    contract: request.contractId,
    function: method,
    args: methodArgs ? encodeSorobanArguments(spec, method, methodArgs) : [],
  });
  const pipeline = request.pipeline ?? createReadFromContractPipeline(request);
  const value = await pipeline({ operations: [operation] });
  return decodeSorobanResult(spec, method, value);
}
