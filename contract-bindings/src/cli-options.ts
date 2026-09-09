import { NetworkConfig } from "@colibri/core";
import { BindingError, Code } from "@/error.ts";

/** CLI interaction interface for terminals or an application-provided prompt UI. */
export type CliIO = {
  /** Whether missing values may be requested. */
  interactive: boolean;
  /** Returns the answer, or null to cancel. */
  prompt(message: string): string | null | Promise<string | null>;
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
const SWITCHES = new Set(["help", "force", "non-interactive", "allow-http"]);
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
  const value = await io.prompt(message + (fallback ? ` [${fallback}]` : ""));
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
/** Resolves missing CLI choices, preserving every explicit flag. */
export async function resolveCliOptions(
  flags: CliFlags,
  io: CliIO,
): Promise<CliFlags> {
  flags = { ...flags };
  if (!["wasm", "wasm-hash", "contract-id"].some((key) => flags[key])) {
    const kind = await answer(
      flags,
      "source",
      "Source (wasm / wasm-hash / contract-id)",
      io,
    );
    if (!["wasm", "wasm-hash", "contract-id"].includes(kind)) {
      throw new BindingError(
        Code.INVALID_OPTIONS,
        "Choose wasm, wasm-hash or contract-id",
      );
    }
    await answer(flags, kind, kind === "wasm" ? "Wasm file path" : kind, io);
  }
  if (!flags.wasm) {
    await answer(
      flags,
      "network",
      "Network (testnet / futurenet / mainnet / custom)",
      io,
    );
    if (flags.network === "custom") {
      await answer(flags, "rpc-url", "RPC URL", io);
      await answer(flags, "network-passphrase", "Network passphrase", io);
    }
  }
  const output = await answer(
    flags,
    "output",
    "Output (files / package)",
    io,
    "files",
  );
  const target = await answer(
    flags,
    "target",
    "Import/package preset (jsr / npm)",
    io,
    "jsr",
  );
  if (
    !["files", "package"].includes(output) || !["jsr", "npm"].includes(target)
  ) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "Expected --output files|package and --target jsr|npm",
    );
  }
  if (output === "package") {
    await answer(flags, "package-name", "Package name", io);
  } else if (flags["package-name"]) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "--package-name requires --output package",
    );
  }
  await answer(flags, "class-name", "Client class name", io, "ContractClient");
  await answer(flags, "out", "Output directory", io, "./bindings");
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
