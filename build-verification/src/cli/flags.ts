import { NetworkConfig } from "@colibri/core";
import type {
  ContractBuildVerificationInput,
  OutOfBandBuildRecipe,
  VerificationNetwork,
  VerificationSource,
  VerificationTarget,
} from "@/core/index.ts";
import { InvalidCliArgumentsError } from "@/cli/error.ts";
import type { BuildVerificationCliIo } from "@/cli/io.ts";
import type { ParsedBuildVerificationFlags } from "@/cli/types.ts";

/** Help text printed by the build-verification CLI. */
export const BUILD_VERIFICATION_CLI_HELP: string = `@colibri/build-verification

Strict SEP-58 verification:
  deno run -A jsr:@colibri/build-verification/cli --contract-id C... --network testnet

Out-of-band verification:
  deno run -A jsr:@colibri/build-verification/cli --wasm target.wasm --source ./source.tar.gz --recipe recipe.json

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
  --github-owner <owner> --github-repository <repo> --github-revision <revision>
  --github-owner <owner> --github-repository <repo> --github-release-tag <tag> --github-release-asset <asset>

Execution and reporting:
  --recipe <path>          Select explicit out-of-band mode
  --allow-build-network    Give the build container network access
  --evidence <path>        Write completed evidence as JSON
  --logs <path>            Write structured logs
  --log-format <jsonl|text>
  --help
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
  "recipe",
  "evidence",
  "logs",
  "log-format",
]);
const BOOLEAN_FLAGS = new Set([
  "allow-http",
  "allow-build-network",
  "help",
]);

/** Parses named CLI flags and rejects repeats or positional arguments. */
export const parseBuildVerificationFlags = (
  args: readonly string[],
): ParsedBuildVerificationFlags => {
  const flags: ParsedBuildVerificationFlags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      throw new InvalidCliArgumentsError(
        "Every CLI argument must be a named --flag.",
        { argument },
      );
    }
    const name = argument.slice(2);
    if (!VALUE_FLAGS.has(name) && !BOOLEAN_FLAGS.has(name)) {
      throw new InvalidCliArgumentsError(`Unknown flag --${name}.`, { name });
    }
    if (flags.has(name)) {
      throw new InvalidCliArgumentsError(`Flag --${name} cannot be repeated.`, {
        name,
      });
    }
    if (BOOLEAN_FLAGS.has(name)) {
      flags.set(name, true);
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new InvalidCliArgumentsError(`Flag --${name} requires a value.`, {
        name,
      });
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
    throw new InvalidCliArgumentsError(
      "Choose exactly one target: --contract-id, --wasm-hash, or --wasm.",
    );
  }
  if (contractId) return { contractId };
  if (wasmHash) return { wasmHash };
  try {
    return { wasm: await io.readFile(wasmPath!), label: wasmPath };
  } catch (cause) {
    throw new InvalidCliArgumentsError(
      "The --wasm target file could not be read.",
      { path: wasmPath, cause: String(cause) },
    );
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
    throw new InvalidCliArgumentsError(
      "--network cannot be combined with granular RPC flags.",
    );
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
    throw new InvalidCliArgumentsError(
      "--network must be mainnet, testnet, or futurenet.",
      { preset },
    );
  }
  if (rpcUrl || passphrase) {
    if (!rpcUrl || !passphrase) {
      throw new InvalidCliArgumentsError(
        "Granular network configuration requires both --rpc-url and --network-passphrase.",
      );
    }
    return {
      rpcUrl,
      networkPassphrase: passphrase,
      allowHttp: flags.has("allow-http"),
    };
  }
  if (flags.has("allow-http")) {
    throw new InvalidCliArgumentsError(
      "--allow-http requires granular RPC flags.",
    );
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
  const groups = [!!path, !!url, !!revision || !!tag || !!asset].filter(
    Boolean,
  );
  if (groups.length > 1) {
    throw new InvalidCliArgumentsError(
      "Choose only one local, URL, GitHub revision, or GitHub release source.",
    );
  }
  const hasGitHubFlag = [owner, repository, revision, tag, asset, format].some(
    Boolean,
  );
  if (!hasGitHubFlag) {
    if (path) return { type: "path", path };
    if (url) return { type: "url", url };
    return undefined;
  }
  if (!owner || !repository) {
    throw new InvalidCliArgumentsError(
      "Every GitHub source requires --github-owner and --github-repository.",
    );
  }
  if (revision) {
    if (tag || asset) {
      throw new InvalidCliArgumentsError(
        "A GitHub revision cannot be combined with release flags.",
      );
    }
    if (format !== undefined && format !== "tar.gz" && format !== "zip") {
      throw new InvalidCliArgumentsError(
        "--github-format must be tar.gz or zip.",
        { format },
      );
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
    throw new InvalidCliArgumentsError(
      "A GitHub release source requires both release flags and does not use --github-format.",
    );
  }
  return { type: "githubReleaseAsset", owner, repository, tag, asset };
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
    throw new InvalidCliArgumentsError(
      "Out-of-band --recipe mode requires an explicit source.",
    );
  }
  let recipe: OutOfBandBuildRecipe;
  try {
    recipe = JSON.parse(await io.readTextFile(recipePath));
  } catch (cause) {
    throw new InvalidCliArgumentsError(
      "The out-of-band recipe file could not be read as JSON.",
      { path: recipePath, cause: String(cause) },
    );
  }
  return { mode: "outOfBand", target, source, recipe };
};
