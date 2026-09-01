import { NetworkConfig } from "@colibri/core";
import type {
  ContractBuildVerificationInput,
  OutOfBandBuildRecipe,
  VerificationNetwork,
  VerificationSource,
  VerificationTarget,
} from "@/core/index.ts";
import { BUILD_VERIFICATION_PACKAGE_VERSION } from "@/core/index.ts";
import {
  CliAllowHttpRequiresNetworkError,
  CliDuplicateFlagError,
  CliEnvironmentReadFailedError,
  CliEnvironmentValueMissingError,
  CliFlagValueMissingError,
  CliGitHubFormatInvalidError,
  CliGitHubReleaseInvalidError,
  CliGitHubRevisionConflictError,
  CliGitHubSourceIncompleteError,
  CliGitHubTokenSourceRequiredError,
  CliNetworkConfigurationConflictError,
  CliNetworkConfigurationIncompleteError,
  CliNetworkPresetInvalidError,
  CliOutOfBandSourceRequiredError,
  CliPositionalArgumentUnsupportedError,
  CliRecipeFileReadFailedError,
  CliRecipeJsonInvalidError,
  CliSourceSelectionInvalidError,
  CliTargetFileReadFailedError,
  CliTargetSelectionInvalidError,
  CliUnknownFlagError,
} from "@/cli/error.ts";
import type { BuildVerificationCliIo } from "@/cli/io.ts";
import type { ParsedBuildVerificationFlags } from "@/cli/types.ts";

/** Help text printed by the build-verification CLI. */
const RUNNABLE_CLI =
  `jsr:@colibri/build-verification@${BUILD_VERIFICATION_PACKAGE_VERSION}/cli`;

/** Help text printed by the build-verification CLI. */
export const BUILD_VERIFICATION_CLI_HELP: string =
  `@colibri/build-verification ${BUILD_VERIFICATION_PACKAGE_VERSION}

Strict SEP-58 verification:
  deno run -A ${RUNNABLE_CLI} --contract-id C... --network testnet

Out-of-band verification:
  deno run -A ${RUNNABLE_CLI} --wasm target.wasm --source ./source.tar.gz --recipe recipe.json

Targets (choose one):
  --contract-id <id>       Resolve a deployed contract through Stellar RPC
  --wasm-hash <hex>        Resolve deployed contract code through Stellar RPC
  --wasm <path>            Verify local Wasm bytes

Network:
  --network <mainnet|testnet|futurenet>
  --rpc-url <url> --network-passphrase <passphrase> [--allow-http]

Source (choose at most one):
  --source <path>
  --source-url <url>
  --github-owner <owner> --github-repository <repo> --github-revision <revision> [--github-format <tar.gz|zip>]
  --github-owner <owner> --github-repository <repo> --github-release-tag <tag> --github-release-asset <asset>
  --github-token-env <name>  Read a GitHub token from an environment variable

Execution and reporting:
  --recipe <path>          Select explicit out-of-band mode
  --allow-build-network    Allow the build container to access the network
  --container-name-prefix <prefix>  Prefix for unique build-container names
  --json                   Print the complete result or error as JSON
  --evidence <path>        Write completed evidence or a failure report as JSON
  --logs <path>            Write structured logs
  --log-format <jsonl|text>
  --quiet                  Suppress the interactive verification spinner
  -h, --help

Docker is required by the default runner. Build-container networking is denied
unless --allow-build-network is supplied.

Exit codes:
  0  Verified
  1  Verification or reporting failed
  2  Rebuilt Wasm does not match the target
  3  Verification is not applicable
`;

const VALUE_FLAGS = new Set([
  "contract-id",
  "wasm-hash",
  "wasm",
  "network",
  "rpc-url",
  "network-passphrase",
  "source",
  "source-url",
  "github-owner",
  "github-repository",
  "github-revision",
  "github-format",
  "github-release-tag",
  "github-release-asset",
  "github-token-env",
  "recipe",
  "container-name-prefix",
  "evidence",
  "logs",
  "log-format",
]);
const BOOLEAN_FLAGS = new Set([
  "allow-http",
  "allow-build-network",
  "json",
  "quiet",
  "help",
]);

/** Parses named CLI flags and rejects repeats or positional arguments. */
export const parseBuildVerificationFlags = (
  args: readonly string[],
): ParsedBuildVerificationFlags => {
  const flags: ParsedBuildVerificationFlags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "-h") {
      if (flags.has("help")) throw new CliDuplicateFlagError("-h");
      flags.set("help", true);
      continue;
    }
    if (!argument.startsWith("--")) {
      if (argument.startsWith("-")) throw new CliUnknownFlagError(argument);
      throw new CliPositionalArgumentUnsupportedError(argument);
    }
    const name = argument.slice(2);
    if (!VALUE_FLAGS.has(name) && !BOOLEAN_FLAGS.has(name)) {
      throw new CliUnknownFlagError(argument);
    }
    if (flags.has(name)) {
      throw new CliDuplicateFlagError(argument);
    }
    if (BOOLEAN_FLAGS.has(name)) {
      flags.set(name, true);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new CliFlagValueMissingError(argument);
    }
    flags.set(name, value);
    index += 1;
  }
  return flags;
};

/** Returns a string flag when present. */
export const getBuildVerificationStringFlag = (
  flags: ParsedBuildVerificationFlags,
  name: string,
): string | undefined => {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
};

/** Converts target flags into one exclusive verification target. */
export const verificationTargetFromFlags = async (
  flags: ParsedBuildVerificationFlags,
  io: BuildVerificationCliIo,
): Promise<VerificationTarget> => {
  const contractId = getBuildVerificationStringFlag(flags, "contract-id");
  const wasmHash = getBuildVerificationStringFlag(flags, "wasm-hash");
  const wasmPath = getBuildVerificationStringFlag(flags, "wasm");
  if ([contractId, wasmHash, wasmPath].filter(Boolean).length !== 1) {
    throw new CliTargetSelectionInvalidError();
  }
  if (contractId) return { contractId };
  if (wasmHash) return { wasmHash };
  try {
    return { wasm: await io.readFile(wasmPath!), label: wasmPath };
  } catch (cause) {
    throw new CliTargetFileReadFailedError(wasmPath!, cause);
  }
};

/** Converts preset or granular RPC flags into the shared network union. */
export const verificationNetworkFromFlags = (
  flags: ParsedBuildVerificationFlags,
): VerificationNetwork | undefined => {
  const preset = getBuildVerificationStringFlag(flags, "network");
  const rpcUrl = getBuildVerificationStringFlag(flags, "rpc-url");
  const passphrase = getBuildVerificationStringFlag(
    flags,
    "network-passphrase",
  );
  if (preset && (rpcUrl || passphrase)) {
    throw new CliNetworkConfigurationConflictError();
  }
  if (preset) {
    if (preset === "mainnet") {
      return { networkConfig: NetworkConfig.MainNet() };
    }
    if (preset === "testnet") {
      return { networkConfig: NetworkConfig.TestNet() };
    }
    if (preset === "futurenet") {
      return { networkConfig: NetworkConfig.FutureNet() };
    }
    throw new CliNetworkPresetInvalidError(preset);
  }
  if (rpcUrl || passphrase) {
    if (!rpcUrl || !passphrase) {
      throw new CliNetworkConfigurationIncompleteError();
    }
    return {
      rpcUrl,
      networkPassphrase: passphrase,
      allowHttp: flags.has("allow-http"),
    };
  }
  if (flags.has("allow-http")) {
    throw new CliAllowHttpRequiresNetworkError();
  }
  return undefined;
};

/** Converts one exclusive source flag group into a provider source. */
export const verificationSourceFromFlags = (
  flags: ParsedBuildVerificationFlags,
): VerificationSource | undefined => {
  const path = getBuildVerificationStringFlag(flags, "source");
  const url = getBuildVerificationStringFlag(flags, "source-url");
  const owner = getBuildVerificationStringFlag(flags, "github-owner");
  const repository = getBuildVerificationStringFlag(
    flags,
    "github-repository",
  );
  const revision = getBuildVerificationStringFlag(flags, "github-revision");
  const tag = getBuildVerificationStringFlag(flags, "github-release-tag");
  const asset = getBuildVerificationStringFlag(
    flags,
    "github-release-asset",
  );
  const format = getBuildVerificationStringFlag(flags, "github-format");
  const hasGitHubFlag = [owner, repository, revision, tag, asset, format].some(
    Boolean,
  );
  const groups = [!!path, !!url, hasGitHubFlag].filter(Boolean);
  if (groups.length > 1) {
    throw new CliSourceSelectionInvalidError();
  }
  if (!hasGitHubFlag) {
    if (path) return { type: "path", path };
    if (url) return { type: "url", url };
    return undefined;
  }
  if (!owner || !repository) {
    throw new CliGitHubSourceIncompleteError();
  }
  if (revision) {
    if (tag || asset) {
      throw new CliGitHubRevisionConflictError();
    }
    if (format !== undefined && format !== "tar.gz" && format !== "zip") {
      throw new CliGitHubFormatInvalidError(format);
    }
    return {
      type: "githubArchive",
      owner,
      repository,
      revision,
      format: format === "zip" ? "zip" : "tarGzip",
    };
  }
  if (!tag || !asset || format) {
    throw new CliGitHubReleaseInvalidError();
  }
  return { type: "githubReleaseAsset", owner, repository, tag, asset };
};

/** Reads an explicitly selected GitHub token without exposing it in arguments. */
export const verificationGitHubTokenFromFlags = (
  flags: ParsedBuildVerificationFlags,
  io: BuildVerificationCliIo,
): string | undefined => {
  const environmentName = getBuildVerificationStringFlag(
    flags,
    "github-token-env",
  );
  if (!environmentName) return undefined;
  const hasGitHubSource = [
    "github-revision",
    "github-release-tag",
    "github-release-asset",
  ].some((flag) => flags.has(flag));
  if (!hasGitHubSource) throw new CliGitHubTokenSourceRequiredError();
  let value: string | undefined;
  try {
    value = (io.getEnv ?? Deno.env.get)(environmentName);
  } catch (cause) {
    throw new CliEnvironmentReadFailedError(environmentName, cause);
  }
  if (!value?.trim()) {
    throw new CliEnvironmentValueMissingError(environmentName);
  }
  return value;
};

/** Builds the strict or explicitly out-of-band request from parsed flags. */
export const verificationInputFromFlags = async (
  flags: ParsedBuildVerificationFlags,
  io: BuildVerificationCliIo,
): Promise<ContractBuildVerificationInput> => {
  const target = await verificationTargetFromFlags(flags, io);
  const source = verificationSourceFromFlags(flags);
  const recipePath = getBuildVerificationStringFlag(flags, "recipe");
  if (!recipePath) return { mode: "strictSep58", target, source };
  if (!source) {
    throw new CliOutOfBandSourceRequiredError();
  }
  let encodedRecipe: string;
  try {
    encodedRecipe = await io.readTextFile(recipePath);
  } catch (cause) {
    throw new CliRecipeFileReadFailedError(recipePath, cause);
  }
  let recipe: OutOfBandBuildRecipe;
  try {
    recipe = JSON.parse(encodedRecipe);
  } catch (cause) {
    throw new CliRecipeJsonInvalidError(recipePath, cause);
  }
  return { mode: "outOfBand", target, source, recipe };
};
