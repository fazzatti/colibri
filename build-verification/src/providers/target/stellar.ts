import {
  ERRORS_LDE,
  LedgerEntries,
  type NetworkConfig,
  type ResolvedContractExecutable,
  type RpcLedgerEntriesClient,
} from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import { xdr } from "stellar-sdk";
import type { ContractId } from "@colibri/core";
import type {
  ResolvedVerificationTarget,
  VerificationExternalReferenceEvidence,
  VerificationNetwork,
} from "@/core/types/index.ts";
import { InvalidVerifierOptionsError } from "@/error/core.ts";
import type {
  NormalizedVerificationNetwork,
  VerificationTargetResolver,
  VerificationTargetResolverInput,
} from "@/providers/target/types.ts";
import {
  MissingTargetNetworkError,
  TargetCodeLookupFailedError,
  TargetExternalReferenceLookupFailedError,
  TargetHashMismatchError,
  TargetInstanceLookupFailedError,
  TargetProviderUnexpectedError,
  TargetRpcInitializationFailedError,
} from "@/providers/target/error.ts";
import { BuildVerificationError } from "@/error/base.ts";

const nowIso = (): string => new Date().toISOString();

const isExternalReferenceResolutionFailure = (cause: unknown): boolean =>
  cause instanceof ERRORS_LDE.INVALID_EXTERNAL_REFERENCE ||
  cause instanceof ERRORS_LDE.EXTERNAL_REFERENCE_OWNER_NOT_CONTRACT ||
  cause instanceof ERRORS_LDE.EXTERNAL_REFERENCE_ENTRY_NOT_FOUND ||
  cause instanceof ERRORS_LDE.EXTERNAL_REFERENCE_VALUE_INVALID;

const isStellarAssetResolution = (
  resolved: ResolvedContractExecutable,
): resolved is Extract<
  ResolvedContractExecutable,
  { executable: { type: "stellarAsset" } }
> => resolved.executable.type === "stellarAsset";

const isExternalReferenceResolution = (
  resolved: ResolvedContractExecutable,
): resolved is Extract<
  ResolvedContractExecutable,
  { executable: { type: "externalRef" } }
> => resolved.executable.type === "externalRef";

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

    let resolved;
    try {
      resolved = "contractId" in target
        ? await ledger.resolveContractExecutable({
          contractId: target.contractId as ContractId,
        })
        : await ledger.resolveContractExecutable({
          externalRef: target.externalRef,
        });
    } catch (cause) {
      if (
        "externalRef" in target || isExternalReferenceResolutionFailure(cause)
      ) {
        throw new TargetExternalReferenceLookupFailedError(
          "contractId" in target ? target.contractId : "externalRef",
          cause,
        );
      }
      throw new TargetInstanceLookupFailedError(target.contractId, cause);
    }
    if (isStellarAssetResolution(resolved)) {
      if (!("contractId" in target)) {
        throw new TargetProviderUnexpectedError(
          new TypeError(
            "A Stellar Asset Contract resolution requires a contract instance",
          ),
        );
      }
      return {
        applicability: "stellarAssetContract",
        kind: "contractId",
        label: target.label,
        contractId: target.contractId,
        lastModifiedLedgerSeq: resolved.instance.lastModifiedLedgerSeq,
        observedAt: this.#now(),
      };
    }
    const resolvedWasmHash = resolved.resolvedWasmHash;
    let code;
    try {
      code = await ledger.contractCode({ hash: resolvedWasmHash });
    } catch (cause) {
      throw new TargetCodeLookupFailedError(
        "contractId" in target ? target.contractId : resolvedWasmHash,
        cause,
      );
    }
    if (code.hash !== resolvedWasmHash) {
      throw new TargetHashMismatchError(
        resolvedWasmHash,
        code.hash,
      );
    }
    let externalReference: VerificationExternalReferenceEvidence | undefined;
    if (isExternalReferenceResolution(resolved)) {
      externalReference = {
        executableOwner: resolved.executable.executableOwner,
        tag: {
          encoding: "base64",
          value: xdr.encodeBytes(resolved.executable.tag, "base64"),
        },
        instance: resolved.instance,
        reference: resolved.reference,
      };
    }
    return {
      applicability: "wasm",
      kind: "contractId" in target ? "contractId" : "externalRef",
      label: target.label,
      contractId: "contractId" in target ? target.contractId : undefined,
      wasm: code.code,
      wasmHash: code.hash,
      externalReference,
      lastModifiedLedgerSeq: code.lastModifiedLedgerSeq,
      observedAt: this.#now(),
    };
  }
}
