import { StrKey } from "@colibri/core";
import { dirname, resolve } from "node:path";
import { BindingError, Code } from "@/error.ts";
import {
  validateClassName,
  validatePackageName,
} from "@/generation/validation.ts";
type ValidationFlags = Readonly<Record<string, string | boolean>>;

const CHOICES: Readonly<Record<string, readonly string[]>> = {
  source: ["wasm", "contract-id", "wasm-hash"],
  network: ["mainnet", "testnet", "futurenet", "custom"],
  output: ["files", "package"],
  target: ["jsr", "npm"],
};

function rpcUrl(value: string, allowHttp: boolean): true | string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Input a complete RPC URL, for example https://rpc.example.com";
  }
  if (url.protocol === "http:" && !allowHttp) {
    return "Use an HTTPS RPC URL, or restart with --allow-http to permit HTTP";
  }
  return ["https:", "http:"].includes(url.protocol) && !!url.hostname
    ? true
    : "The RPC URL must use https:// (or http:// with --allow-http)";
}

async function wasmPath(value: string): Promise<true | string> {
  using file = await Deno.open(value, { read: true });
  return (await file.stat()).isFile
    ? true
    : "Input a WASM file path, not a directory";
}

async function outputPath(value: string): Promise<true | string> {
  let path = resolve(value);
  while (true) {
    try {
      return (await Deno.stat(path)).isDirectory
        ? true
        : "The output path or one of its parents is a file; choose a directory";
    } catch (cause) {
      if (!(cause instanceof Deno.errors.NotFound)) throw cause;
      const parent = dirname(path);
      if (parent === path) throw cause;
      path = parent;
    }
  }
}

async function validatePath(
  key: string,
  value: string,
): Promise<true | string> {
  if (value.includes("\0")) return "Paths cannot contain null characters";
  try {
    return await (key === "wasm" ? wasmPath(value) : outputPath(value));
  } catch (cause) {
    if (cause instanceof Deno.errors.NotCapable) {
      throw new BindingError(
        Code.INVALID_OPTIONS,
        "Input validation needs file access; run the CLI with --allow-read for the input and output paths",
        cause,
      );
    }
    return key === "wasm"
      ? "Cannot read this WASM file; check that the path exists and is readable"
      : "Cannot access the output directory; check the path and permissions";
  }
}

/** @internal Local validation only; does not contact RPC or create output paths. */
export async function validateCliValue(
  key: string,
  value: string,
  flags: ValidationFlags,
): Promise<true | string> {
  if (!value.trim()) return `A value for --${key} is required`;
  if (Object.hasOwn(CHOICES, key)) {
    return CHOICES[key].includes(value)
      ? true
      : `Choose --${key} ${CHOICES[key].join("|")}`;
  }
  switch (key) {
    case "contract-id":
      return StrKey.isValidContractId(value) ||
        "Invalid contract ID. Input a C-address with a valid checksum (56 characters beginning with C)";
    case "wasm-hash":
      return /^[a-fA-F0-9]{64}$/.test(value) ||
        "Invalid WASM hash. Input exactly 64 hexadecimal characters";
    case "rpc-url":
      return rpcUrl(value, flags["allow-http"] === true);
    case "wasm":
    case "out":
      return await validatePath(key, value);
    default:
      return validateName(key, value, flags);
  }
}

function validateName(
  key: string,
  value: string,
  flags: ValidationFlags,
): true | string {
  try {
    if (key === "class-name") validateClassName(value);
    if (key === "package-name") {
      validatePackageName(value, flags.target as string | undefined);
    }
    return true;
  } catch (cause) {
    if (cause instanceof BindingError) return cause.message;
    throw cause;
  }
}
