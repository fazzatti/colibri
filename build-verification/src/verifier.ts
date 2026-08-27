import { resolve } from "node:path";
import { ColibriError, LedgerEntries } from "@colibri/core";
import type {
  ContractId,
  ContractInstanceLedgerEntry,
  NetworkConfig,
  RpcLedgerEntriesClient,
} from "@colibri/core";
import { Server } from "stellar-sdk/rpc";
import { DockerBuildRunner } from "@/docker-runner.ts";
import {
  EvidenceWriteFailedError,
  ImagePolicyRejectedError,
  InvalidVerifierOptionsError,
  MissingOutOfBandRecipeError,
  MissingTargetNetworkError,
  TargetResolutionFailedError,
  TargetRpcInitializationFailedError,
} from "@/error.ts";
import { equalBytes, sha256Hex } from "@/hash.ts";
import { OfficialStellarImagePolicy, resolveContainerImage } from "@/image.ts";
import {
  extractContractMetadata,
  parseOutOfBandRecipe,
  parseSep58Recipe,
} from "@/metadata.ts";
import { prepareSource } from "@/source.ts";
import type {
  BuildVerificationLimits,
  ContractBuildVerificationEvidence,
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
  ContractBuildVerifierOptions,
  VerificationNetwork,
  VerificationTarget,
} from "@/types.ts";
import { DEFAULT_BUILD_VERIFICATION_LIMITS } from "@/types.ts";

type ResolvedTarget = {
  readonly kind: "wasm" | "wasmHash" | "contractId";
  readonly label?: string;
  readonly contractId?: string;
  readonly wasmHash?: string;
  readonly wasm?: Uint8Array;
  readonly lastModifiedLedgerSeq?: number;
  readonly notApplicable?: "stellarAssetContract";
};

/** @internal Creates the Colibri ledger reader for any supported network shape. */
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

const validateNetwork = (network: VerificationNetwork | undefined): void => {
  if (!network) return;
  const configured = ["networkConfig", "rpc", "rpcUrl"].filter((key) =>
    key in network && network[key as keyof VerificationNetwork] !== undefined
  );
  if (configured.length !== 1) {
    throw new InvalidVerifierOptionsError(
      "Network inputs must select exactly one of networkConfig, rpc, or rpcUrl.",
      { configured },
    );
  }
  if (("rpc" in network || "rpcUrl" in network) && !network.networkPassphrase) {
    throw new InvalidVerifierOptionsError(
      "Granular RPC network inputs require networkPassphrase.",
    );
  }
};

const resolveTarget = async (
  target: VerificationTarget,
  network: VerificationNetwork | undefined,
): Promise<ResolvedTarget> => {
  if ("wasm" in target) {
    return {
      kind: "wasm",
      label: target.label,
      wasm: target.wasm,
      wasmHash: await sha256Hex(target.wasm),
    };
  }
  if (!network) throw new MissingTargetNetworkError();
  let ledger: LedgerEntries;
  try {
    ledger = createVerificationLedgerEntries(network);
  } catch (cause) {
    throw new TargetRpcInitializationFailedError(cause);
  }
  if ("wasmHash" in target) {
    try {
      const code = await ledger.contractCode({ hash: target.wasmHash });
      return {
        kind: "wasmHash",
        label: target.label,
        wasm: code.code,
        wasmHash: code.hash,
        lastModifiedLedgerSeq: code.lastModifiedLedgerSeq,
      };
    } catch (cause) {
      throw new TargetResolutionFailedError(target.wasmHash, cause);
    }
  }

  let instance: ContractInstanceLedgerEntry;
  try {
    instance = await ledger.contractInstance({
      contractId: target.contractId as ContractId,
    });
  } catch (cause) {
    throw new TargetResolutionFailedError(target.contractId, cause);
  }
  if (instance.executable.type !== "wasm") {
    return {
      kind: "contractId",
      label: target.label,
      contractId: target.contractId,
      notApplicable: "stellarAssetContract",
      lastModifiedLedgerSeq: instance.lastModifiedLedgerSeq,
    };
  }
  try {
    const code = await ledger.contractCode({
      hash: instance.executable.wasmHash,
    });
    return {
      kind: "contractId",
      label: target.label,
      contractId: target.contractId,
      wasm: code.code,
      wasmHash: code.hash,
      lastModifiedLedgerSeq: code.lastModifiedLedgerSeq,
    };
  } catch (cause) {
    throw new TargetResolutionFailedError(target.contractId, cause);
  }
};

const mergedLimits = (
  overrides: ContractBuildVerifierOptions["limits"],
): BuildVerificationLimits => {
  const limits = { ...DEFAULT_BUILD_VERIFICATION_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new InvalidVerifierOptionsError(
        "Every build-verification limit must be a positive finite number.",
        { name, value },
      );
    }
  }
  return limits;
};

const networkEvidence = (
  network: VerificationNetwork | undefined,
): ContractBuildVerificationEvidence["network"] => {
  if (!network) return undefined;
  if ("networkConfig" in network && network.networkConfig) {
    return {
      networkPassphrase: network.networkConfig.networkPassphrase,
      rpcUrl: network.networkConfig.rpcUrl,
    };
  }
  return {
    networkPassphrase: network.networkPassphrase,
    rpcUrl: "rpcUrl" in network ? network.rpcUrl : undefined,
  };
};

/** Rebuilds Stellar contract wasm and compares it byte-for-byte with a target. */
export class ContractBuildVerifier {
  readonly #options: ContractBuildVerifierOptions;
  readonly #limits: BuildVerificationLimits;

  /** Creates a reusable verifier with optional network, policy, and runner configuration. */
  constructor(options: ContractBuildVerifierOptions = {}) {
    validateNetwork(options.network);
    this.#limits = mergedLimits(options.limits);
    this.#options = options;
  }

  /** Runs strict SEP-58 verification or an explicitly labeled out-of-band rebuild. */
  async verify(
    input: ContractBuildVerificationInput,
  ): Promise<ContractBuildVerificationResult> {
    const mode = input.mode ?? "strictSep58";
    const target = await resolveTarget(input.target, this.#options.network);
    if (target.notApplicable) {
      return { status: "notApplicable", reason: target.notApplicable };
    }
    const targetWasm = target.wasm!;
    const targetWasmHash = target.wasmHash!;
    const metadata = extractContractMetadata(targetWasm);

    let recipe;
    let source;
    if (mode === "strictSep58") {
      recipe = parseSep58Recipe(metadata);
      if (!recipe) {
        return {
          status: "notApplicable",
          reason: "missingSep58Metadata",
          targetWasmHash,
        };
      }
      source = input.source;
    } else {
      if (!("recipe" in input) || !input.recipe) {
        throw new MissingOutOfBandRecipeError();
      }
      recipe = parseOutOfBandRecipe(input.recipe);
      source = input.source;
    }

    const fetcher = this.#options.fetch ?? globalThis.fetch;
    const imageDetails = await resolveContainerImage(recipe.image, fetcher);
    const imagePolicy = this.#options.imagePolicy ??
      new OfficialStellarImagePolicy();
    try {
      await imagePolicy.validate(imageDetails);
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new ImagePolicyRejectedError(
        recipe.image,
        cause instanceof Error ? cause.message : String(cause),
      );
    }

    const preparedSource = await prepareSource({
      source,
      metadataUrl: recipe.sourceUri,
      expectedSha256: recipe.sourceSha256,
      strict: mode === "strictSep58",
      fetcher,
      limits: this.#limits,
    });
    try {
      const runner = this.#options.runner ?? new DockerBuildRunner();
      const build = await runner.run({
        sourceDirectory: preparedSource.directory,
        recipe,
        allowNetwork: this.#options.allowBuildNetwork ?? false,
        limits: this.#limits,
      });
      const rebuiltWasmHash = await sha256Hex(build.wasm);
      const evidence: ContractBuildVerificationEvidence = {
        mode,
        recipeProvenance: mode === "strictSep58"
          ? "onChainSep58Metadata"
          : "callerSupplied",
        network: networkEvidence(this.#options.network),
        target: {
          kind: target.kind,
          label: target.label,
          contractId: target.contractId,
          wasmHash: targetWasmHash,
          lastModifiedLedgerSeq: target.lastModifiedLedgerSeq,
        },
        source: {
          kind: preparedSource.kind,
          locator: preparedSource.locator,
          sha256: preparedSource.sha256,
        },
        build: {
          image: recipe.image,
          arguments: recipe.arguments,
          options: recipe.options,
          networkEnabled: this.#options.allowBuildNetwork ?? false,
          artifactPath: build.artifactPath,
          rebuiltWasmHash,
          durationMs: build.durationMs,
          stdout: build.stdout,
          stderr: build.stderr,
        },
        observedAt: new Date().toISOString(),
      };
      return {
        status: equalBytes(targetWasm, build.wasm) ? "verified" : "mismatch",
        evidence,
      };
    } finally {
      await preparedSource.cleanup();
    }
  }
}

/** Verifies one contract build without retaining a verifier instance. */
export const verifyContractBuild = (
  input: ContractBuildVerificationInput,
  options?: ContractBuildVerifierOptions,
): Promise<ContractBuildVerificationResult> =>
  new ContractBuildVerifier(options).verify(input);

/** Writes completed verification evidence as stable, indented JSON. */
export const writeVerificationEvidence = async (
  path: string,
  evidence: ContractBuildVerificationEvidence,
): Promise<void> => {
  try {
    await Deno.writeTextFile(
      resolve(path),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
  } catch (cause) {
    throw new EvidenceWriteFailedError(path, cause);
  }
};
