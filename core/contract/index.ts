import type { Spec } from "stellar-sdk/contract";
import type { ContractConstructorArgs } from "./types.ts";
import type { Buffer } from "node:buffer";
import type { NetworkConfig } from "../network/index.ts";
import { Server } from "stellar-sdk/rpc";
import {
  type InvokeContractPipeline,
  PIPE_InvokeContract,
} from "../pipelines/invoke-contract/index.ts";
import {
  type ReadFromContractPipeline,
  PIPE_ReadFromContract,
} from "../pipelines/read-from-contract/index.ts";
import { assertRequiredArgs } from "../common/assert/assert-args.ts";
import { assert } from "../common/assert/assert.ts";
import type { ContractId } from "../strkeys/types.ts";
import { Operation } from "stellar-sdk";
import type { TransactionConfig } from "../common/types/transaction-config/types.ts";
import type { InvokeContractOutput } from "../pipelines/invoke-contract/types.ts";
import * as E from "./error.ts";
import { getWasmHashFromGetTransactionResponse } from "../common/helpers/get-transaction-response.ts";
export class Contract {
  private rpcHandler: Server;
  private networkConfig: NetworkConfig;
  private readPipe: ReadFromContractPipeline;
  private invokePipe: InvokeContractPipeline;

  private spec?: Spec;
  private wasm?: Buffer;
  private wasmHash?: string;
  private contractId?: string;

  constructor({ networkConfig, rpc, contractConfig }: ContractConstructorArgs) {
    assertRequiredArgs(
      {
        networkConfig: networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        contractConfig,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    this.networkConfig = networkConfig;
    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl);
    }

    this.rpcHandler = rpc;
    this.invokePipe = PIPE_InvokeContract.create({
      networkConfig,
      rpc,
    });
    this.readPipe = PIPE_ReadFromContract.create({
      networkConfig,
      rpc,
    });

    const { spec, contractId, wasm, wasmHash } = contractConfig;

    if (spec) {
      this.spec = spec;
    }
    if (contractId) {
      this.contractId = contractId;
    }
    if (wasm) {
      this.wasm = wasm;
    }
    if (wasmHash) {
      this.wasmHash = wasmHash;
    }

    const hasValidContractConfig =
      this.contractId || this.wasm || !this.wasmHash;

    assert(hasValidContractConfig, new E.INVALID_CONTRACT_CONFIG());
  }

  private require(arg: "spec"): Spec;
  private require(arg: "wasm"): Buffer;
  private require(arg: "wasmHash"): string;
  private require(arg: "contractId"): ContractId;
  private require(
    arg: "spec" | "contractId" | "wasm" | "wasmHash"
  ): ContractId | Spec | Buffer | string {
    if (!this[arg]) {
      throw new Error(`Missing required contract property: ${arg}`);
    }

    return this[arg];
  }

  public getContractId(): string {
    return this.require("contractId");
  }

  public getSpec(): Spec {
    return this.require("spec");
  }

  public getWasm(): Buffer {
    return this.require("wasm");
  }

  public getWasmHash(): string {
    return this.require("wasmHash");
  }

  //   public getContractFootprint(): xdr.LedgerKey {
  //     this.require("contractId");
  //     return new Contract(this.contractId!).getFootprint();
  //   }

  //   public getRpcHandler(): RpcHandler {
  //     return this.rpcHandler;
  //   }

  //==========================================
  // Meta Management Methods
  //==========================================
  //
  //

  /**
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   *
   * @description - Uploads the contract wasm to the network and stores the wasm hash in this contract instance.
   *
   * @requires - The wasm file buffer to be set in the contract engine.
   *
   * */
  public async uploadWasm(
    config: TransactionConfig
  ): Promise<InvokeContractOutput> {
    const wasm = this.getWasm();

    try {
      const uploadOperation = Operation.uploadContractWasm({
        wasm: wasm,
      });

      const result = await this.invokePipe.run({
        config: config as TransactionConfig,
        operations: [uploadOperation],
      });

      this.wasmHash = getWasmHashFromGetTransactionResponse(result.response);

      return result;
    } catch (error) {
      throw new E.FAILED_TO_UPLOAD_WASM(error as Error);
    }
  }
}
