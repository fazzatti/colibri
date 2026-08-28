import {
  LedgerEntries,
  type NetworkConfig,
  type RpcLedgerEntriesClient,
} from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import type { ContractId } from "@colibri/core";
import type {
  ResolvedVerificationTarget,
  VerificationNetwork,
} from "../../core/types/index.ts";
import { InvalidVerifierOptionsError } from "../../error/core.ts";
import type {
  NormalizedVerificationNetwork,
  VerificationTargetResolver,
  VerificationTargetResolverInput,
} from "./types.ts";
import {
  MissingTargetNetworkError,
  TargetCodeLookupFailedError,
  TargetHashMismatchError,
  TargetInstanceLookupFailedError,
  TargetProviderUnexpectedError,
  TargetRpcInitializationFailedError,
} from "./error.ts";
import { BuildVerificationError } from "../../error/base.ts";

const nowIso = (): string => new Date().toISOString();

/** Creates the Colibri ledger reader for one already validated network shape. */
export const createVerificationLedgerEntries = (
  network: VerificationNetwork,
): LedgerEntries => {
  if ("networkConfig" in network && network.networkConfig) {
    return new LedgerEntries({
      networkConfig: network.networkConfig as NetworkConfig,
    });
  }
  if ("rpc" in network && network.rpc) {
    return new LedgerEntries({ rpc: network.rpc });
  }
  const rpc = new Server(network.rpcUrl, {
    allowHttp: network.allowHttp ?? false,
  }) as RpcLedgerEntriesClient;
  return new LedgerEntries({ rpc });
};

/** Validates exclusivity and normalizes network inputs once. */
export const normalizeVerificationNetwork = (
  network: VerificationNetwork,
): NormalizedVerificationNetwork => {
  const object = network as unknown as Record<string, unknown>;
  const configured = ["networkConfig", "rpc", "rpcUrl"].filter((key) =>
    object[key] !== undefined
  );
  if (configured.length !== 1) {
    throw new InvalidVerifierOptionsError(
      "Network inputs must select exactly one of networkConfig, rpc, or rpcUrl.",
      { configured },
    );
  }
  const isConfig = "networkConfig" in network && !!network.networkConfig;
  const passphrase = isConfig
    ? network.networkConfig.networkPassphrase
    : "networkPassphrase" in network
    ? network.networkPassphrase
    : undefined;
  if (!passphrase || typeof passphrase !== "string") {
    throw new InvalidVerifierOptionsError(
      "Every network input requires a non-empty network passphrase.",
    );
  }
  try {
    return {
      ledgerEntries: createVerificationLedgerEntries(network),
      evidence: {
        networkPassphrase: passphrase,
        rpcUrl: isConfig
          ? network.networkConfig.rpcUrl
          : "rpcUrl" in network
          ? network.rpcUrl
          : undefined,
        allowHttp: isConfig
          ? network.networkConfig.allowHttp ?? false
          : "rpcUrl" in network
          ? network.allowHttp ?? false
          : false,
        input: isConfig
          ? "networkConfig"
          : "rpcUrl" in network
          ? "rpcUrl"
          : "rpc",
      },
    };
  } catch (cause) {
    if (cause instanceof BuildVerificationError) throw cause;
    throw new TargetRpcInitializationFailedError(cause);
  }
};

/** Resolves contract IDs and Wasm hashes through Colibri ledger entries. */
export class StellarVerificationTargetResolver
  implements VerificationTargetResolver {
  readonly #network?: NormalizedVerificationNetwork;
  readonly #now: () => string;

  /** Creates a Stellar resolver with optional network and deterministic clock. */
  constructor(
    network?: NormalizedVerificationNetwork,
    now: () => string = nowIso,
  ) {
    this.#network = network;
    this.#now = now;
  }

  /** Resolves an RPC-backed target into exact Wasm or SAC classification. */
  async resolve(
    input: VerificationTargetResolverInput,
  ): Promise<ResolvedVerificationTarget> {
    const target = input.target;
    if ("wasm" in target) {
      throw new TargetProviderUnexpectedError(
        new TypeError("Stellar resolver received a direct Wasm target"),
      );
    }
    if (!this.#network) throw new MissingTargetNetworkError();
    const ledger = this.#network.ledgerEntries;
    if ("wasmHash" in target) {
      let code;
      try {
        code = await ledger.contractCode({ hash: target.wasmHash });
      } catch (cause) {
        throw new TargetCodeLookupFailedError(target.wasmHash, cause);
      }
      if (code.hash !== target.wasmHash) {
        throw new TargetHashMismatchError(target.wasmHash, code.hash);
      }
      return {
        applicability: "wasm",
        kind: "wasmHash",
        label: target.label,
        wasm: code.code,
        wasmHash: code.hash,
        lastModifiedLedgerSeq: code.lastModifiedLedgerSeq,
        observedAt: this.#now(),
      };
    }

    let instance;
    try {
      instance = await ledger.contractInstance({
        contractId: target.contractId as ContractId,
      });
    } catch (cause) {
      throw new TargetInstanceLookupFailedError(target.contractId, cause);
    }
    if (instance.executable.type !== "wasm") {
      return {
        applicability: "stellarAssetContract",
        kind: "contractId",
        label: target.label,
        contractId: target.contractId,
        lastModifiedLedgerSeq: instance.lastModifiedLedgerSeq,
        observedAt: this.#now(),
      };
    }
    let code;
    try {
      code = await ledger.contractCode({ hash: instance.executable.wasmHash });
    } catch (cause) {
      throw new TargetCodeLookupFailedError(target.contractId, cause);
    }
    if (code.hash !== instance.executable.wasmHash) {
      throw new TargetHashMismatchError(
        instance.executable.wasmHash,
        code.hash,
      );
    }
    return {
      applicability: "wasm",
      kind: "contractId",
      label: target.label,
      contractId: target.contractId,
      wasm: code.code,
      wasmHash: code.hash,
      lastModifiedLedgerSeq: code.lastModifiedLedgerSeq,
      observedAt: this.#now(),
    };
  }
}
