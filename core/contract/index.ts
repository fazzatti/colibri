import { Spec } from "stellar-sdk/contract";
import { type Api, Server } from "stellar-sdk/rpc";
import { Contract as StellarContract } from "stellar-sdk";
import type { ContractConfig, ContractConstructorArgs } from "./types.ts";
import { Buffer } from "node:buffer";
import type { NetworkConfig } from "../network/index.ts";
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
import {
  Address,
  type Asset,
  Operation,
  type OperationOptions,
  xdr,
} from "stellar-sdk";
import type { TransactionConfig } from "../common/types/transaction-config/types.ts";
import type { InvokeContractOutput } from "../pipelines/invoke-contract/types.ts";
import * as E from "./error.ts";
import {
  getContractIdFromGetTransactionResponse,
  getWasmHashFromGetTransactionResponse,
} from "../common/helpers/get-transaction-response.ts";
import { processSpecEntryStream } from "../common/helpers/wasm.ts";
import { generateRandomSalt } from "../common/helpers/generate-random-salt.ts";
import { SIMULATION_FAILED } from "../processes/simulate-transaction/error.ts";
import { getStellarAssetContractIdFromFailedSimulationResponse } from "../common/helpers/failed-simulation-response.ts";
export class Contract {
  private rpc: Server;
  private networkConfig: NetworkConfig;
  private readPipe: ReadFromContractPipeline;
  private invokePipe: InvokeContractPipeline;

  private spec?: Spec;
  private wasm?: Buffer;
  private wasmHash?: string;
  private contractId?: string;

  private constructor({
    networkConfig,
    rpc,
    contractConfig,
  }: ContractConstructorArgs) {
    assertRequiredArgs(
      {
        networkConfig: networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        contractConfig: contractConfig,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    this.networkConfig = networkConfig;
    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl);
    }

    this.rpc = rpc;
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
  }

  static create({
    networkConfig,
    rpc,
    contractConfig,
  }: ContractConstructorArgs): Contract {
    const contract = new Contract({ networkConfig, rpc, contractConfig });

    const hasValidContractConfig =
      contract.contractId || contract.wasm || contract.wasmHash;

    assert(hasValidContractConfig, new E.INVALID_CONTRACT_CONFIG());

    return contract as Contract;
  }

  static async wrapAssetAndInitialize({
    networkConfig,
    rpc,
    asset,
    config,
  }: {
    networkConfig: NetworkConfig;
    rpc?: Server;
    asset: Asset;
    config: TransactionConfig;
  }): Promise<Contract> {
    const contract = new Contract({
      networkConfig,
      rpc,
      contractConfig: {} as unknown as ContractConfig,
    });

    await contract.wrapAndDeployClassicAsset({
      config,
      asset,
    });

    return contract;
  }

  //==========================================
  // Meta Requirement Methods
  //==========================================
  //
  //

  private require(arg: "spec"): Spec;
  private require(arg: "wasm"): Buffer;
  private require(arg: "wasmHash"): string;
  private require(arg: "contractId"): ContractId;
  private require(
    arg: "spec" | "contractId" | "wasm" | "wasmHash"
  ): ContractId | Spec | Buffer | string {
    assert(this[arg], new E.MISSING_REQUIRED_PROPERTY(arg));
    return this[arg];
  }

  private requireNo(arg: "spec" | "contractId" | "wasm" | "wasmHash"): void {
    assert(!this[arg], new E.PROPERTY_ALREADY_SET(arg));
  }

  private requireNoContractId(): void {
    this.requireNo("contractId");
  }

  private requireNoSpec(): void {
    this.requireNo("spec");
  }

  //==========================================
  // Public Getter Methods
  //==========================================
  //
  //

  public getContractId(): ContractId {
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

  public getContractFootprint(): xdr.LedgerKey {
    return new StellarContract(this.getContractId()).getFootprint();
  }

  public async getContractCodeLedgerEntry(): Promise<Api.LedgerEntryResult> {
    const ledgerEntries = (await this.rpc.getLedgerEntries(
      xdr.LedgerKey.contractCode(
        new xdr.LedgerKeyContractCode({
          hash: Buffer.from(this.getWasmHash(), "hex"),
        })
      )
    )) as Api.GetLedgerEntriesResponse;

    const contractCode = ledgerEntries.entries.find(
      (entry) => entry.key.switch().name === "contractCode"
    );

    assert(contractCode, new E.CONTRACT_CODE_NOT_FOUND(this.getWasmHash()));

    return contractCode as Api.LedgerEntryResult;
  }

  public async getContractInstanceLedgerEntry(): Promise<Api.LedgerEntryResult> {
    const footprint = this.getContractFootprint();

    const ledgerEntries = (await this.rpc.getLedgerEntries(
      footprint
    )) as Api.GetLedgerEntriesResponse;

    const contractInstance = ledgerEntries.entries.find(
      (entry) => entry.key.switch().name === "contractData"
    );

    assert(
      contractInstance,
      new E.CONTRACT_INSTANCE_NOT_FOUND(this.getContractId())
    );
    return contractInstance as Api.LedgerEntryResult;
  }

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

  /**
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   * @param {T} constructorArgs - The arguments to pass to the contract constructor, if any.
   *
   * @description - Deploys a new instance of the contract to the network and stores the contract id in the contract instance.
   *
   * @requires - The wasm hash to be set in the contract instance.
   *
   * */
  public async deploy<T>({
    config,
    constructorArgs,
  }: {
    config: TransactionConfig;
    constructorArgs?: T;
  }): Promise<InvokeContractOutput> {
    const wasmHash = this.getWasmHash();

    try {
      const encodedArgs = constructorArgs
        ? this.getSpec().funcArgsToScVals("__constructor", constructorArgs)
        : undefined;

      const deployOperation = Operation.createCustomContract({
        address: new Address(config.source),
        wasmHash: Buffer.from(wasmHash, "hex"),
        salt: generateRandomSalt(),
        constructorArgs: encodedArgs,
      } as OperationOptions.CreateCustomContract);

      const result = await this.invokePipe.run({
        config,
        operations: [deployOperation],
      });

      this.contractId = getContractIdFromGetTransactionResponse(
        result.response
      );

      return result;
    } catch (error) {
      throw new E.FAILED_TO_DEPLOY_CONTRACT(error as Error);
    }
  }

  public async wrapAndDeployClassicAsset({
    config,
    asset,
  }: {
    config: TransactionConfig;
    asset: Asset;
  }): Promise<ContractId> {
    this.requireNoContractId();

    try {
      const wrapOperation = Operation.createStellarAssetContract({
        asset: asset,
      } as OperationOptions.CreateStellarAssetContract);

      const result = await this.invokePipe.run({
        config,
        operations: [wrapOperation],
      });

      this.contractId = getContractIdFromGetTransactionResponse(
        result.response
      );

      return this.contractId as ContractId;
    } catch (error) {
      if (error instanceof SIMULATION_FAILED) {
        try {
          const contractId =
            getStellarAssetContractIdFromFailedSimulationResponse(
              error.meta.data.simulationResponse
            );

          if (contractId) {
            this.contractId = contractId;
            return this.contractId as ContractId;
          }
        } catch (_innerError) {
          // Ignore inner errors related to extracting contract ID
        }
      }

      throw new E.FAILED_TO_WRAP_ASSET(asset, error as Error);
    }
  }

  /**
   *
   * @param {void} args - No arguments.
   *
   * @returns {Promise<void>} - The output of the invocation.
   *
   * @description - Loads the contract specification from the wasm file and stores it in the contract instance.
   */
  public async loadSpecFromWasm(): Promise<void> {
    const wasm = this.getWasm();

    const wasmModule = await WebAssembly.compile(wasm as BufferSource);
    const xdrSections = WebAssembly.Module.customSections(
      wasmModule,
      "contractspecv0"
    );

    assert(xdrSections.length > 0, new E.MISSING_SPEC_IN_WASM());
    // The spec is stored in the 'contractspecv0' custom section of the wasm file.
    // There should only be one such section, so we take the first one.
    // We then parse the section as a stream of XDR-encoded SpecEntry objects.

    const bufferSection = Buffer.from(xdrSections[0]);
    const specEntryArray = processSpecEntryStream(bufferSection);
    const spec = new Spec(specEntryArray);
    this.spec = spec;
  }

  /**
   *
   * @param {void} args - No arguments.
   *
   * @returns {Promise<void>} - The output of the invocation.
   *
   * @description - Loads the contract specification from the wasm binaries deployed on-chain and stores it in the contract instance.
   *
   * @requires - The wasm hash or the contract id to be set in the contract instance.
   */
  public async loadSpecFromDeployedContract(): Promise<void> {
    this.requireNoSpec();

    if (!this.wasmHash) await this.loadWasmHashFromContractInstance();

    const contractCodeEntry = await this.getContractCodeLedgerEntry();

    const wasm = contractCodeEntry.val.contractCode().code();

    this.wasm = wasm;

    await this.loadSpecFromWasm();
  }

  /**
   *
   * @param {void} args - No arguments.
   *
   * @returns {Promise<void>} - The output of the invocation.
   *
   * @description - Loads the code wasm hash from the network and stores it in the contract instance.
   *
   * @requires - The the contract id to be set in the contract instance.
   */
  public async loadWasmHashFromContractInstance(): Promise<void> {
    this.requireNo("wasmHash");
    const contractInstanceEntry = await this.getContractInstanceLedgerEntry();

    const wasmHash = contractInstanceEntry.val
      .contractData()
      .val()
      .instance()
      .executable()
      .wasmHash();

    this.wasmHash = wasmHash.toString("hex");
  }

  //==========================================
  // Invocation Methods
  //==========================================
  //
  //

  /**
   *
   * @args {SorobanSimulateArgs<object>} args - The arguments for the invocation.
   * @param {string} args.method - The method to invoke as it is identified in the contract.
   * @param {object} args.methodArgs - The arguments for the method invocation.
   * @param {EnvelopeHeader} args.header - The header for the invocation.
   *
   * @returns {Promise<unknown>} The output of the invocation.
   *
   * @description - Simulate an invocation of a contract method that does not alter the state of the contract.
   * This function does not require any signers. It builds a transaction, simulates it, and extracts the output of the invocation from the simulation.
   *
   */
  public async read({
    method,
    methodArgs,
  }: {
    method: string;
    methodArgs?: object | undefined;
  }) {
    const contractId = this.getContractId();

    const encodedArgs = methodArgs
      ? this.getSpec().funcArgsToScVals(method, methodArgs)
      : undefined;

    const operation = Operation.invokeContractFunction({
      function: method,
      contract: contractId,
      args: encodedArgs || [],
    });

    const scValOutput = await this.readPipe.run({ operations: [operation] });
    return this.getSpec().funcResToNative(method, scValOutput);
  }

  /**
   *
   * @param {string} method - The method to invoke as it is identified in the contract.
   * @param {object} .methodArgs - The arguments for the method invocation.
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   *
   * @returns {Promise<unknown>} The output of the invocation.
   *
   * @description - Invokes a contract method that alters the state of the contract.
   * This function requires signers. It builds a transaction, simulates it, signs it, submits it to the network, and extracts the output of the invocation from the processed transaction.
   *
   */
  public async invoke({
    method,
    methodArgs,
    config,
  }: {
    method: string;
    methodArgs?: object;
    config: TransactionConfig;
  }): Promise<InvokeContractOutput> {
    const contractId = this.getContractId();

    const encodedArgs = methodArgs
      ? this.getSpec().funcArgsToScVals(method, methodArgs)
      : undefined;

    const operation = Operation.invokeContractFunction({
      function: method,
      contract: contractId,
      args: encodedArgs || [],
    });

    return await this.invokePipe.run({ config, operations: [operation] });
  }
}
