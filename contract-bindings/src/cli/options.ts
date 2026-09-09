import { NetworkConfig } from "@colibri/core";
import { BindingError, Code } from "@/error.ts";

/** CLI interaction interface for terminals or an application-provided prompt UI. */
export type CliIO = {
  /** Whether missing values may be requested. */
  interactive: boolean;
  /** Returns the answer, or null to cancel. */
  prompt(
    message: string,
    defaultValue?: string,
  ): string | null | Promise<string | null>;
  /** Selects a labeled option. Prompt-only adapters may omit this callback. */
  select?(
    message: string,
    options: readonly { name: string; value: string }[],
    defaultValue?: string,
  ): string | null | Promise<string | null>;
  /** Displays progress and warnings. */
  log(message: string): void;
};
/** Parsed string flags and boolean switches. */
export type CliFlags = Record<string, string | boolean>;
const VALUE_FLAGS = new Set([
  "wasm",
  "wasm-hash",
  "contract-id",
  "network",
  "rpc-url",
  "network-passphrase",
  "output",
  "target",
  "package-name",
  "class-name",
  "out",
]);
const SWITCHES = new Set([
  "help",
  "force",
  "non-interactive",
  "allow-http",
  "include-provenance",
]);
/** Parses flags without I/O; rejects typos, duplicate options and ambiguous sources. */
export function parseCliArgs(args: readonly string[]): CliFlags {
  const flags: CliFlags = {};
  for (let i = 0; i < args.length; i++) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(args[i]);
    if (!match) {
      throw new BindingError(
        Code.INVALID_OPTIONS,
        `Expected --option, received ${args[i]}`,
      );
    }
    const [, key, inline] = match;
    if (Object.hasOwn(flags, key)) {
      throw new BindingError(Code.INVALID_OPTIONS, `Duplicate --${key}`);
    }
    if (SWITCHES.has(key)) {
      if (inline !== undefined) {
        throw new BindingError(Code.INVALID_OPTIONS, `--${key} takes no value`);
      }
      flags[key] = true;
    } else if (VALUE_FLAGS.has(key)) {
      const value = inline ?? args[++i];
      if (!value || value.startsWith("--")) {
        throw new BindingError(
          Code.INVALID_OPTIONS,
          `Missing value for --${key}`,
        );
      }
      flags[key] = value;
    } else throw new BindingError(Code.INVALID_OPTIONS, `Unknown --${key}`);
  }
  if (
    ["wasm", "wasm-hash", "contract-id"].filter((key) => flags[key]).length > 1
  ) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "Choose exactly one source: --wasm, --wasm-hash or --contract-id",
    );
  }
  return flags;
}
async function answer(
  flags: CliFlags,
  key: string,
  message: string,
  io: CliIO,
  fallback?: string,
): Promise<string> {
  if (typeof flags[key] === "string") return flags[key] as string;
  if (!io.interactive || flags["non-interactive"]) {
    if (fallback !== undefined) return flags[key] = fallback;
    throw new BindingError(
      Code.INVALID_OPTIONS,
      `Missing --${key}; use interactive mode or supply this flag`,
    );
  }
  const value = await io.prompt(message, fallback);
  if (value === null) {
    throw new BindingError(Code.CANCELLED, "Generation cancelled");
  }
  const resolved = value.trim() || fallback;
  if (!resolved) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      `A value for --${key} is required`,
    );
  }
  return flags[key] = resolved;
}

async function choose(
  flags: CliFlags,
  key: string,
  message: string,
  options: readonly { name: string; value: string }[],
  io: CliIO,
  fallback?: string,
): Promise<string> {
  const value = await answer(flags, key, message, {
    ...io,
    prompt: () =>
      io.select ? io.select(message, options, fallback) : io.prompt(
        `${message} (${options.map((option) => option.value).join(" / ")})`,
        fallback,
      ),
  }, fallback);
  if (!options.some((option) => option.value === value)) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      `Choose --${key} ${options.map((option) => option.value).join("|")}`,
    );
  }
  return value;
}

const SOURCES = [
  { name: "WASM file", value: "wasm" },
  { name: "Contract ID", value: "contract-id" },
  { name: "WASM hash", value: "wasm-hash" },
];
const SOURCE_INPUTS: Readonly<Record<string, string>> = {
  wasm: "Input the path to the WASM file",
  "contract-id": "Input the contract ID",
  "wasm-hash": "Input the WASM hash",
};
const NETWORKS = [
  { name: "Mainnet", value: "mainnet" },
  { name: "Testnet", value: "testnet" },
  { name: "Futurenet", value: "futurenet" },
  { name: "Custom — provide an RPC URL and passphrase", value: "custom" },
];
/** Resolves missing CLI choices, preserving every explicit flag. */
export async function resolveCliOptions(
  flags: CliFlags,
  io: CliIO,
): Promise<CliFlags> {
  flags = { ...flags };
  if (!["wasm", "wasm-hash", "contract-id"].some((key) => flags[key])) {
    const kind = await choose(
      flags,
      "source",
      "Select the contract source",
      SOURCES,
      io,
    );
    await answer(flags, kind, SOURCE_INPUTS[kind], io);
  }
  if (!flags.wasm) {
    await choose(
      flags,
      "network",
      "Select the network",
      NETWORKS,
      io,
    );
    if (flags.network === "custom") {
      await answer(flags, "rpc-url", "Input the RPC URL", io);
      await answer(
        flags,
        "network-passphrase",
        "Input the network passphrase",
        io,
      );
    }
  }
  const output = await choose(
    flags,
    "output",
    "Select the output",
    [
      { name: "Files — add bindings to an existing project", value: "files" },
      { name: "Package — create a standalone package", value: "package" },
    ],
    io,
    "files",
  );
  await choose(
    flags,
    "target",
    "Select the import and package preset",
    [
      { name: "JSR", value: "jsr" },
      { name: "npm", value: "npm" },
    ],
    io,
    "jsr",
  );
  if (output === "package") {
    await answer(
      flags,
      "package-name",
      "Input the package name (for example, @example/token)",
      io,
    );
  } else if (flags["package-name"]) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "--package-name requires --output package",
    );
  }
  await answer(flags, "out", "Input the output directory", io, "./bindings");
  return flags;
}
/** @internal Resolves a selected preset with explicit endpoint overrides. */
export function cliNetwork(flags: CliFlags): NetworkConfig {
  const rpcUrl = flags["rpc-url"] as string | undefined;
  const allowHttp = flags["allow-http"] === true;
  if (flags["network-passphrase"] && flags.network !== "custom") {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "--network-passphrase requires --network custom",
    );
  }
  switch (flags.network) {
    case "testnet":
      return NetworkConfig.TestNet({ rpcUrl, allowHttp });
    case "futurenet":
      return NetworkConfig.FutureNet({ rpcUrl, allowHttp });
    case "mainnet":
      return NetworkConfig.MainNet({ rpcUrl, allowHttp });
    case "custom":
      return NetworkConfig.CustomNet({
        rpcUrl,
        networkPassphrase: flags["network-passphrase"] as string,
        allowHttp,
      });
    default:
      throw new BindingError(
        Code.INVALID_OPTIONS,
        "Select --network testnet|futurenet|mainnet|custom",
      );
  }
}
