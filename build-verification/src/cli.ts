import { ColibriError, NetworkConfig } from "@colibri/core";
import { InvalidCliArgumentsError } from "@/error.ts";
import {
  ContractBuildVerifier,
  writeVerificationEvidence,
} from "@/verifier.ts";
import type {
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
  ContractBuildVerifierOptions,
  OutOfBandBuildRecipe,
  VerificationNetwork,
  VerificationSource,
  VerificationTarget,
} from "@/types.ts";

/** Injectable verifier construction and evidence-writing boundaries for CLI embedders. */
export type BuildVerificationCliDependencies = {
  readonly createVerifier?: (
    options: ContractBuildVerifierOptions,
  ) => {
    verify(
      input: ContractBuildVerificationInput,
    ): Promise<ContractBuildVerificationResult>;
  };
  readonly writeEvidence?: typeof writeVerificationEvidence;
};

/** Injectable terminal boundary used by the CLI and its tests. */
export type BuildVerificationCliIo = {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly readTextFile: (path: string) => Promise<string>;
};

const DEFAULT_IO: BuildVerificationCliIo = {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  readFile: Deno.readFile,
  readTextFile: Deno.readTextFile,
};

const HELP = `@colibri/build-verification

Strict SEP-58 verification:
  deno run -A jsr:@colibri/build-verification/cli --contract-id C... --network testnet

Out-of-band verification:
  deno run -A jsr:@colibri/build-verification/cli --wasm target.wasm --source ./source.tar.gz --recipe recipe.json

Targets (choose one):
  --contract-id <id>       Resolve a deployed contract through Stellar RPC
  --wasm-hash <hex>        Resolve deployed contract code through Stellar RPC
  --wasm <path>            Verify local wasm bytes

Network:
  --network <mainnet|testnet|futurenet>
  --rpc-url <url> --network-passphrase <passphrase> [--allow-http]

Source and execution:
  --source <path>          Source archive, or directory in out-of-band mode
  --source-url <url>       Source archive URL
  --recipe <path>          JSON out-of-band recipe; selecting this mode is explicit
  --allow-build-network    Give the build container network access (disabled by default)
  --evidence <path>        Write completed comparison evidence to JSON
  --help                   Show this help
`;

type ParsedFlags = Map<string, string | true>;
const VALUE_FLAGS = new Set([
  "contract-id",
  "wasm-hash",
  "wasm",
  "network",
  "rpc-url",
  "network-passphrase",
  "source",
  "source-url",
  "recipe",
  "evidence",
]);
const BOOLEAN_FLAGS = new Set(["allow-http", "allow-build-network", "help"]);

const parseFlags = (args: readonly string[]): ParsedFlags => {
  const flags: ParsedFlags = new Map();
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

const stringFlag = (flags: ParsedFlags, name: string): string | undefined => {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
};

const targetFromFlags = async (
  flags: ParsedFlags,
  io: BuildVerificationCliIo,
): Promise<VerificationTarget> => {
  const contractId = stringFlag(flags, "contract-id");
  const wasmHash = stringFlag(flags, "wasm-hash");
  const wasmPath = stringFlag(flags, "wasm");
  const values = [contractId, wasmHash, wasmPath].filter(Boolean);
  if (values.length !== 1) {
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

const networkFromFlags = (
  flags: ParsedFlags,
): VerificationNetwork | undefined => {
  const preset = stringFlag(flags, "network");
  const rpcUrl = stringFlag(flags, "rpc-url");
  const networkPassphrase = stringFlag(flags, "network-passphrase");
  if (preset && (rpcUrl || networkPassphrase)) {
    throw new InvalidCliArgumentsError(
      "--network cannot be combined with granular --rpc-url or --network-passphrase flags.",
    );
  }
  if (preset) {
    if (preset === "mainnet") return { networkConfig: NetworkConfig.MainNet() };
    if (preset === "testnet") return { networkConfig: NetworkConfig.TestNet() };
    if (preset === "futurenet") {
      return { networkConfig: NetworkConfig.FutureNet() };
    }
    throw new InvalidCliArgumentsError(
      "--network must be mainnet, testnet, or futurenet.",
      { preset },
    );
  }
  if (rpcUrl || networkPassphrase) {
    if (!rpcUrl || !networkPassphrase) {
      throw new InvalidCliArgumentsError(
        "Granular network configuration requires both --rpc-url and --network-passphrase.",
      );
    }
    return { rpcUrl, networkPassphrase, allowHttp: flags.has("allow-http") };
  }
  if (flags.has("allow-http")) {
    throw new InvalidCliArgumentsError(
      "--allow-http requires --rpc-url and --network-passphrase.",
    );
  }
  return undefined;
};

const sourceFromFlags = (
  flags: ParsedFlags,
): VerificationSource | undefined => {
  const path = stringFlag(flags, "source");
  const url = stringFlag(flags, "source-url");
  if (path && url) {
    throw new InvalidCliArgumentsError(
      "Choose either --source or --source-url, not both.",
    );
  }
  if (path) return { type: "path", path };
  if (url) return { type: "url", url };
  return undefined;
};

const inputFromFlags = async (
  flags: ParsedFlags,
  io: BuildVerificationCliIo,
): Promise<ContractBuildVerificationInput> => {
  const target = await targetFromFlags(flags, io);
  const source = sourceFromFlags(flags);
  const recipePath = stringFlag(flags, "recipe");
  if (!recipePath) return { mode: "strictSep58", target, source };
  if (!source) {
    throw new InvalidCliArgumentsError(
      "Out-of-band --recipe mode also requires --source or --source-url.",
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

/** Executes the package CLI and returns its process exit code. */
export const runBuildVerificationCli = async (
  args: readonly string[],
  io: BuildVerificationCliIo = DEFAULT_IO,
  dependencies: BuildVerificationCliDependencies = {},
): Promise<number> => {
  try {
    const flags = parseFlags(args);
    if (flags.has("help")) {
      if (flags.size !== 1) {
        throw new InvalidCliArgumentsError(
          "--help cannot be combined with other flags.",
        );
      }
      io.stdout(HELP);
      return 0;
    }
    const input = await inputFromFlags(flags, io);
    const options: ContractBuildVerifierOptions = {
      network: networkFromFlags(flags),
      allowBuildNetwork: flags.has("allow-build-network"),
    };
    const verifier = dependencies.createVerifier?.(options) ??
      new ContractBuildVerifier(options);
    const result = await verifier.verify(input);
    const evidencePath = stringFlag(flags, "evidence");
    if (evidencePath && "evidence" in result) {
      await (dependencies.writeEvidence ?? writeVerificationEvidence)(
        evidencePath,
        result.evidence,
      );
    }
    io.stdout(JSON.stringify(result, null, 2));
    return result.status === "mismatch" ? 2 : 0;
  } catch (cause) {
    const error = ColibriError.is(cause) ? cause : new InvalidCliArgumentsError(
      "The CLI encountered an unexpected failure before verification completed.",
      { cause: String(cause) },
    );
    io.stderr(JSON.stringify(error.toJSON(), null, 2));
    return 1;
  }
};
