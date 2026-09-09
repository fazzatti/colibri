import { loadBindingSource } from "@/source/load.ts";
import { generateBindings } from "@/generation/generate.ts";
import { writeBindings, type WriteBindingsResult } from "@/output/write.ts";
import {
  type CliIO,
  cliNetwork,
  parseCliArgs,
  resolveCliOptions,
} from "@/cli/options.ts";
import type { BindingSource } from "@/types.ts";
import { BindingError, Code } from "@/error.ts";
import { createTerminalIO } from "@/cli/terminal.ts";
import { defaultClassName } from "@/cli/naming.ts";
export {
  type CliFlags,
  type CliIO,
  parseCliArgs,
  resolveCliOptions,
} from "@/cli/options.ts";

/** CLI usage; the same flags work in interactive and automation modes. */
export const CLI_HELP: string = `Colibri contract bindings
Run: deno run --allow-read --allow-write --allow-net jsr:@colibri/contract-bindings/cli [flags]

Source (choose one): --wasm FILE | --wasm-hash HASH | --contract-id ID
Network sources: --network testnet|futurenet|mainnet|custom
  --rpc-url URL                 Override the preset endpoint
  --network-passphrase TEXT     Required for custom networks
  --allow-http                  Explicitly allow HTTP RPC
Output: --output files|package --target jsr|npm --out DIRECTORY
  --class-name NAME             Override the filename-derived class (remote: ContractClient)
  --include-provenance          Include source identity in constants.ts (off by default)
  --package-name @scope/name    Required with --output package
  --non-interactive             Never prompt; fail for missing required flags
  --force                       Replace marked generated files; preserve scaffold
  --help                        Show this guide

No flags: use arrow keys and Enter to select choices, then type or paste inputs.
Partial flags: ask only for missing choices. Ctrl+C or Ctrl+D cancels the wizard.
Full flags: suitable for automation. A local Wasm source needs no network access.
Generation never deploys a contract or submits a transaction.`;

/** Runs the Deno CLI. Returns written paths, or undefined for --help. */
export async function runCli(
  args: readonly string[],
  io?: CliIO,
): Promise<WriteBindingsResult | undefined> {
  const terminal = io ?? createTerminalIO();
  const parsed = parseCliArgs(args);
  if (parsed.help) {
    terminal.log(CLI_HELP);
    return;
  }
  const flags = await resolveCliOptions(parsed, terminal);
  let source: BindingSource;
  if (flags.wasm) {
    try {
      source = {
        kind: "wasm",
        wasm: await Deno.readFile(flags.wasm as string),
      };
    } catch (cause) {
      throw new BindingError(
        Code.SOURCE_FAILED,
        "Could not read the Wasm file",
        cause,
      );
    }
  } else {
    const networkConfig = cliNetwork(flags);
    source = flags["contract-id"]
      ? {
        kind: "contract",
        contractId: flags["contract-id"] as string,
        networkConfig,
      }
      : { kind: "hash", wasmHash: flags["wasm-hash"] as string, networkConfig };
  }
  const loaded = await loadBindingSource(source);
  const className = flags["class-name"] as string | undefined ??
    defaultClassName(flags.wasm as string | undefined);
  const plan = generateBindings(loaded.spec, {
    className,
    output: flags.output as "files" | "package",
    target: flags.target as "jsr" | "npm",
    packageName: flags["package-name"] as string | undefined,
    provenance: flags["include-provenance"] ? loaded.provenance : undefined,
  });
  for (const warning of plan.warnings) terminal.log(warning);
  const result = await writeBindings(plan, {
    directory: flags.out as string,
    force: flags.force === true,
  });
  terminal.log(
    `Generated ${className} in ${flags.out} (${result.written.length} files); preserved ${result.preserved.length} existing scaffold files.`,
  );
  return result;
}
