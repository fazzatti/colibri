import {
  Address,
  Contract as StellarContract,
  Operation,
  xdr,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { Spec } from "stellar-sdk/contract";
import {
  createInvokeContractPipeline,
  type InvokeContractPipeline,
} from "@/pipelines/invoke-contract/index.ts";
import {
  CONTRACT_ERROR_MATCHER_PLUGIN_ID,
  CONTRACT_ERROR_MATCHER_PLUGIN_TARGET,
  createContractErrorMatcherPlugin,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import { extractContractErrorMapFromSpec } from "@/plugins/processes/simulate-transaction/contract-error-matcher/helpers.ts";
import {
  createReadFromContractPipeline,
  type ReadFromContractPipeline,
} from "@/pipelines/read-from-contract/index.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  getContractIdFromGetTransactionResponse,
  getWasmHashFromGetTransactionResponse,
} from "@/common/helpers/get-transaction-response.ts";
import { processSpecEntryStream } from "@/common/helpers/wasm.ts";
import { generateRandomSalt } from "@/common/helpers/generate-random-salt.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import * as E from "@/contract/error.ts";
import type {
  ContractConstructorArgs,
  LoadContractErrorsFromWasmArgs,
} from "@/contract/types.ts";
import type { Api } from "stellar-sdk/rpc";
import type { ContractId } from "@/strkeys/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type {
  BinaryData,
  ExternalExecutableRef,
  LedgerKeyLike,
  ScValLike,
  SorobanAuthorizationEntryLike,
} from "@/common/types/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { InvokeContractOutput } from "@/pipelines/invoke-contract/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import {
  buildContractCodeLedgerKey,
  LedgerEntries,
} from "@/ledger-entries/index.ts";
import type { ReadFromContractOutput } from "@/pipelines/read-from-contract/types.ts";
import type {
  ContractErrorMatcherPluginConfig,
  KnownContractErrorMap,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import type { ContractCodeLedgerEntry } from "@/ledger-entries/types.ts";

type PipelinePluginIdentity = {
  readonly id: string;
  readonly target: string;
};

/**
 * High-level client for interacting with a Soroban contract.
 *
 * `Contract` owns both read and invoke pipelines. Advanced callers can attach
 * plugins to those owned pipelines with `contractConfig.plugins`. For
 * contract-error matching, call `loadContractErrorsFromWasm(...)` to derive
 * the error map from the loaded contract spec or WASM and install the built-in
 * matcher on both pipelines.
 */
export class Contract {
  /** @internal */
  readonly rpc: Server;
  /** Network configuration backing the contract client. */
  readonly networkConfig: NetworkConfig;
  /** Read-only pipeline used to simulate contract calls. */
  readonly readPipe: ReadFromContractPipeline;
  /** Invocation pipeline used for state-changing contract calls. */
  readonly invokePipe: InvokeContractPipeline;

  /** @internal */
  protected spec?: Spec;
  /** @internal */
  protected wasm?: Uint8Array;
  /** @internal */
  protected wasmHash?: string;
  /** @internal */
  protected contractId?: ContractId;
  /** @internal */
  protected externalRef?: ExternalExecutableRef;

  /**
   * Creates a contract client bound to the provided network and contract configuration.
   *
   * @param args - Client configuration including network settings and contract identity.
   */
  constructor({ networkConfig, rpc, contractConfig }: ContractConstructorArgs) {
    assertRequiredArgs(
      {
        networkConfig: networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        contractConfig: contractConfig,
      },
      (argName: string) => new E.MISSING_ARG(argName),
    );

    this.networkConfig = networkConfig;
    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl, {
        allowHttp: networkConfig.allowHttp ?? false,
      });
    }

    this.rpc = rpc;
    this.invokePipe = createInvokeContractPipeline({
      networkConfig,
      rpc,
    });
    this.readPipe = createReadFromContractPipeline({
      networkConfig,
      rpc,
    });

    const { spec, contractId, wasm, wasmHash, externalRef, plugins } =
      contractConfig;
    const configuredSources: string[] = [];
    if (contractId !== undefined) configuredSources.push("contractId");
    if (wasm !== undefined) configuredSources.push("wasm");
    if (wasmHash !== undefined) configuredSources.push("wasmHash");
    if (externalRef !== undefined) configuredSources.push("externalRef");

    if (configuredSources.length > 1) {
      throw new E.CONTRACT_CONFIG_SOURCES_CONFLICT(configuredSources);
    }
    assert(configuredSources.length === 1, new E.INVALID_CONTRACT_CONFIG());

    for (const plugin of plugins?.invokePipe ?? []) {
      this.invokePipe.use(plugin);
    }
    for (const plugin of plugins?.readPipe ?? []) {
      this.readPipe.use(plugin);
    }

    if (spec) {
      this.spec = spec;
    }
    if (contractId) {
      assert(
        StrKey.isContractId(contractId),
        new E.INVALID_CONTRACT_ID(contractId),
      );
      this.contractId = contractId;
    }
    if (wasm) {
      this.wasm = toUint8Array(wasm);
    }
    if (wasmHash) {
      this.wasmHash = wasmHash;
    }
    if (externalRef) {
      this.externalRef = externalRef;
    }
  }

  //==========================================
  // Meta Requirement Methods
  //==========================================
  //
  //

  /** @internal */
  protected require(arg: "spec"): Spec;
  /** @internal */
  protected require(arg: "wasm"): Uint8Array;
  /** @internal */
  protected require(arg: "wasmHash"): string;
  /** @internal */
  protected require(arg: "contractId"): ContractId;
  /** @internal */
  protected require(arg: "externalRef"): ExternalExecutableRef;
  /** @internal */
  protected require(
    arg: "spec" | "contractId" | "wasm" | "wasmHash" | "externalRef",
  ): ContractId | ExternalExecutableRef | Spec | Uint8Array | string {
    assert(this[arg], new E.MISSING_REQUIRED_PROPERTY(arg));
    return this[arg];
  }

  /** @internal */
  protected requireNo(arg: "spec" | "contractId" | "wasm" | "wasmHash"): void {
    assert(!this[arg], new E.PROPERTY_ALREADY_SET(arg));
  }

  /** @internal */
  protected requireNoContractId(): void {
    this.requireNo("contractId");
  }

  /** @internal */
  protected requireNoSpec(): void {
    this.requireNo("spec");
  }

  /** @internal */
  private hasContractErrorMatcherPlugin(
    pipe: InvokeContractPipeline | ReadFromContractPipeline,
  ): boolean {
    const plugins = pipe.plugins as readonly PipelinePluginIdentity[];

    return plugins.some((plugin) =>
      plugin.id === CONTRACT_ERROR_MATCHER_PLUGIN_ID &&
      plugin.target === CONTRACT_ERROR_MATCHER_PLUGIN_TARGET
    );
  }

  /** @internal */
  private assertNoContractErrorMatcherPlugin(): void {
    const invokePipe = this.hasContractErrorMatcherPlugin(this.invokePipe);
    const readPipe = this.hasContractErrorMatcherPlugin(this.readPipe);

    if (invokePipe || readPipe) {
      throw new E.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED({
        invokePipe,
        readPipe,
      });
    }
  }

  /** @internal */
  private createContractErrorMatcherConfig(
    args: LoadContractErrorsFromWasmArgs,
    errors: KnownContractErrorMap,
  ): ContractErrorMatcherPluginConfig {
    if (args.strategy === "any") return errors;

    if (args.strategy === "contract-id") {
      return [{
        strategy: "contract-id",
        contractId: args.contractId ?? this.getContractId(),
        errors,
      }];
    }

    return [{
      strategy: "issued-from",
      issuedFrom: args.issuedFrom,
      errors,
    }];
  }

  //==========================================
  // Public Getter Methods
  //==========================================
  //
  //

  /** Returns the contract id bound to this client. */
  public getContractId(): ContractId {
    return this.require("contractId");
  }

  /** @internal */
  public getSpec(): Spec {
    return this.require("spec");
  }

  /**
   * Returns the contract wasm currently associated with this client.
   */
  public getWasm(): Uint8Array {
    return this.require("wasm");
  }

  /** Returns the wasm hash currently associated with this client. */
  public getWasmHash(): string {
    return this.require("wasmHash");
  }

  /** Returns the CAP-85 executable reference configured for deployment. */
  public getExternalRef(): ExternalExecutableRef {
    return this.require("externalRef");
  }

  /** @internal */
  public getContractFootprint(): LedgerKeyLike {
    return new StellarContract(this.getContractId()).getFootprint();
  }

  /** @internal */
  public async getContractCodeLedgerEntry(): Promise<Api.LedgerEntryResult> {
    const code = await this.getNetworkContractCode();
    return code.xdr as Api.LedgerEntryResult;
  }

  /** @internal */
  public async getContractInstanceLedgerEntry(): Promise<
    Api.LedgerEntryResult
  > {
    const footprint = this.getContractFootprint();

    const ledgerEntries = (await this.rpc.getLedgerEntries(
      footprint as xdr.LedgerKey,
    )) as Api.GetLedgerEntriesResponse;

    const contractInstance = ledgerEntries.entries.find(
      (entry) => entry.key.type === "contractData",
    );

    assert(
      contractInstance,
      new E.CONTRACT_INSTANCE_NOT_FOUND(this.getContractId()),
    );
    return contractInstance as Api.LedgerEntryResult;
  }

  //==========================================
  // Meta Management Methods
  //==========================================
  //
  //

  /**
   * Uploads this client's Wasm to the configured Stellar network.
   *
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   *
   * @description - Uploads the contract wasm to the network and stores the wasm hash in this contract instance.
   *
   * @requires - The wasm file buffer to be set in the contract engine.
   */
  public async uploadWasm(
    config: TransactionConfig,
  ): Promise<InvokeContractOutput> {
    const wasm = this.getWasm();

    try {
      const uploadOperation = Operation.uploadContractWasm({
        wasm,
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
   * Deploys a new contract instance from uploaded Wasm or an external reference.
   *
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   * @param {T} constructorArgs - The arguments to pass to the contract constructor, if any.
   * @param salt - The 32-byte deployment salt. When omitted, a random
   * `Uint8Array` salt is generated.
   *
   * @description - Deploys a new instance of the contract to the network and stores the contract id in the contract instance.
   *
   * @requires - A Wasm hash or external executable reference to be configured.
   */
  public async deploy<T>({
    config,
    constructorArgs,
    salt,
  }: {
    config: TransactionConfig;
    constructorArgs?: T;
    salt?: BinaryData;
  }): Promise<InvokeContractOutput> {
    const contractSalt = salt || generateRandomSalt();

    try {
      const encodedArgs = constructorArgs
        ? this.getSpec().funcArgsToScVals("__constructor", constructorArgs)
        : undefined;

      const common = {
        address: new Address(config.source),
        salt: toUint8Array(contractSalt),
        constructorArgs: encodedArgs,
      };
      const deployOperation = this.externalRef
        ? Operation.createCustomContract({
          ...common,
          externalRef: this.externalRef,
        })
        : Operation.createCustomContract({
          ...common,
          wasmHash: xdr.decodeBytes(this.getWasmHash(), "hex"),
        });

      const result = await this.invokePipe.run({
        config,
        operations: [deployOperation],
      });

      this.contractId = getContractIdFromGetTransactionResponse(
        result.response,
      );

      return result;
    } catch (error) {
      throw new E.FAILED_TO_DEPLOY_CONTRACT(error as Error);
    }
  }

  /**
   * Loads the contract specification from this client's local Wasm.
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
      "contractspecv0",
    );

    assert(xdrSections.length > 0, new E.MISSING_SPEC_IN_WASM());
    // The spec is stored in the 'contractspecv0' custom section of the wasm file.
    // There should only be one such section, so we take the first one.
    // We then parse the section as a stream of XDR-encoded SpecEntry objects.

    const specEntryArray = processSpecEntryStream(xdrSections[0]);
    const spec = new Spec(specEntryArray);
    this.spec = spec;
  }

  /**
   * Loads the contract specification from code available on the network.
   *
   * @param {void} args - No arguments.
   *
   * @returns {Promise<void>} - The output of the invocation.
   *
   * @description Resolves a configured Wasm hash, external reference, or
   * contract id to the currently selected network Wasm, then replaces this
   * client's local Wasm and specification. Calling this method again
   * intentionally refreshes mutable external-reference mappings.
   *
   * @requires - A Wasm hash, external reference, or contract id to be configured.
   */
  public async loadSpecFromNetwork(): Promise<void> {
    const contractCode = await this.getNetworkContractCode();
    this.wasm = Uint8Array.from(contractCode.code);

    await this.loadSpecFromWasm();
  }

  /**
   * Loads known contract-error names from the contract spec and installs the
   * matcher plugin on this client's read and invoke pipelines.
   *
   * If the contract spec is already loaded, this method uses it directly. If no
   * spec is loaded, it loads the spec from local WASM when available, otherwise
   * it fetches the deployed WASM through the configured RPC server. The derived
   * map uses each contract error code as the key and the error enum case name
   * as the message.
   *
   * The method is intentionally guarded: if the built-in contract-error matcher
   * plugin is already attached to either owned pipeline, it throws instead of
   * adding a second matcher with ambiguous ordering.
   *
   * @param args - Matching strategy used when installing the derived map. With
   * `contract-id`, omit `contractId` to use this contract client's bound id.
   * @returns The derived contract-error map.
   * @throws When the matcher plugin is already attached to either owned
   * pipeline.
   *
   * @example Load and install known errors for any matching contract-error code.
   * ```ts
   * const errors = await contract.loadContractErrorsFromWasm({
   *   strategy: "any",
   * });
   * ```
   */
  public async loadContractErrorsFromWasm(
    args: LoadContractErrorsFromWasmArgs,
  ): Promise<KnownContractErrorMap> {
    this.assertNoContractErrorMatcherPlugin();

    if (!this.spec) {
      if (this.wasm) {
        await this.loadSpecFromWasm();
      } else {
        await this.loadSpecFromNetwork();
      }
    }

    const errors = extractContractErrorMapFromSpec(this.getSpec());

    if (Object.keys(errors).length === 0) {
      return errors;
    }

    const matcherConfig = this.createContractErrorMatcherConfig(args, errors);
    this.invokePipe.use(createContractErrorMatcherPlugin(matcherConfig));
    this.readPipe.use(createContractErrorMatcherPlugin(matcherConfig));

    return errors;
  }

  /** @internal */
  private async getNetworkContractCode(): Promise<ContractCodeLedgerEntry> {
    const ledger = new LedgerEntries({ rpc: this.rpc });
    let wasmHash = this.wasmHash;

    if (this.contractId) {
      const resolved = await ledger.resolveContractExecutable({
        contractId: this.contractId,
      });
      if (resolved.executable.type === "stellarAsset") {
        throw new E.STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM();
      }
      wasmHash = resolved.resolvedWasmHash;
      if (resolved.executable.type === "wasm") {
        this.wasmHash = wasmHash;
      }
    } else if (this.externalRef) {
      const resolved = await ledger.resolveContractExecutable({
        externalRef: this.externalRef,
      });
      wasmHash = resolved.resolvedWasmHash;
    }

    if (!wasmHash) {
      throw new E.NETWORK_EXECUTABLE_NOT_AVAILABLE();
    }

    const code = await ledger.get(buildContractCodeLedgerKey({
      hash: wasmHash,
    }));
    assert(code, new E.CONTRACT_CODE_NOT_FOUND(wasmHash));
    return code;
  }

  //==========================================
  // Invocation Methods
  //==========================================
  //
  //

  /**
   * Simulates a read-only contract method and decodes its result.
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
   */
  public async read({
    method,
    methodArgs,
  }: {
    method: string;
    methodArgs?: object | undefined;
  }): Promise<unknown> {
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
   * Invokes a state-changing contract method through the invoke pipeline.
   *
   * @param {string} method - The method to invoke as it is identified in the contract.
   * @param {object} .methodArgs - The arguments for the method invocation.
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   *
   * @returns {Promise<unknown>} The output of the invocation.
   *
   * @description - Invokes a contract method that alters the state of the contract.
   * This function requires signers. It builds a transaction, simulates it, signs it, submits it to the network, and extracts the output of the invocation from the processed transaction.
   */
  public async invoke({
    method,
    methodArgs,
    auth,
    config,
  }: {
    method: string;
    methodArgs?: object;
    auth?: SorobanAuthorizationEntryLike[];
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
      auth: auth as xdr.SorobanAuthorizationEntry[] | undefined,
    });

    return await this.invokePipe.run({ config, operations: [operation] });
  }

  /**
   * Invokes a state-changing contract method with already encoded ScVal arguments.
   *
   * This is the escape hatch for methods that are not represented by a loaded
   * contract specification or by a specialized Colibri client.
   *
   * @param {object} operationArgs - The raw arguments for the operation.
   * @param {string} operationArgs.function - The function name to invoke.
   * @param {xdr.ScVal[]} operationArgs.args - The arguments for the function invocation as ScVal array.
   * @param {xdr.SorobanAuthorizationEntry[]} [operationArgs.auth] - Optional authorization entries for the invocation.
   * @param {TransactionConfig} config - The transaction configuration object to use in this transaction.
   *
   * @returns The processed transaction and raw contract return value.
   *
   * @description - Invokes a contract method that alters the state of the contract.
   * This function requires signers. It builds a transaction, simulates it, signs it, submits it to the network, and extracts the output of the invocation from the processed transaction.
   */
  public async invokeRaw({
    operationArgs,
    config,
  }: {
    operationArgs: {
      function: string;
      args: ScValLike[];
      auth?: SorobanAuthorizationEntryLike[];
    };
    config: TransactionConfig;
  }): Promise<InvokeContractOutput> {
    const contractId = this.getContractId();

    const operation = Operation.invokeContractFunction({
      ...operationArgs,
      contract: contractId,
    });

    return await this.invokePipe.run({ config, operations: [operation] });
  }

  /**
   * Simulates a read-only method using already encoded ScVal arguments.
   *
   * @param {string} method - The method to invoke as it is identified in the contract.
   * @param {ScValLike[]} methodArgs - The arguments for the method invocation in ScVal array.
   *
   * @returns {Promise<ReadFromContractOutput>} The returned value of the simulated invocation
   * encoded as ScVal array.
   *
   * @description - Simulate an invocation of a contract method that does not alter the state of the contract.
   */
  public async readRaw({
    method,
    methodArgs,
  }: {
    method: string;
    methodArgs?: ScValLike[] | undefined;
  }): Promise<ReadFromContractOutput> {
    const contractId = this.getContractId();

    const operation = Operation.invokeContractFunction({
      function: method,
      contract: contractId,
      args: (methodArgs as xdr.ScVal[] | undefined) || [],
    });

    return await this.readPipe.run({ operations: [operation] });
  }
}
