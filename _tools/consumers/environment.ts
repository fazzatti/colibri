/** Isolated source graphs for consumer testing, with explicit dependency selection. */
import { copyConsumerFixtures } from "./fixtures.ts";
export { fixtureRoot } from "./fixtures.ts";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  readPackageInventory,
  type WorkspacePackage,
} from "../package-inventory.ts";
import { runtimeImports } from "../releases/repository.ts";
import { accepts } from "../releases/model.ts";

export const root = resolve(import.meta.dirname!, "../..");
export const dockerPackages = new Set([
  "@colibri/test-tooling",
  "@colibri/build-verification",
]);
/** Runtime-specific subpaths are checked by Deno, not packaged as Node artifacts. */
export const denoOnlyEntrypoints = new Set(["@colibri/contract-bindings/cli"]);
export const playwrightVersion = "1.61.0";

export async function command(
  executable: string,
  args: string[],
  cwd: string,
): Promise<void> {
  const result = await new Deno.Command(executable, {
    args,
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!result.success) {
    throw new Error(
      `CONSUMER_COMMAND_FAILED: ${executable} ${
        args.join(" ")
      } (${result.code})`,
    );
  }
}

export async function copyRuntime(from: string, to: string): Promise<void> {
  await Deno.mkdir(to, { recursive: true });
  for await (const entry of Deno.readDir(from)) {
    if (
      ["node_modules", ".git", "coverage", "dist"].includes(entry.name) ||
      entry.name.endsWith(".test.ts")
    ) continue;
    const source = resolve(from, entry.name);
    const target = resolve(to, entry.name);
    if (entry.isDirectory) await copyRuntime(source, target);
    else if (entry.isFile && /(?:\.ts|\.json|\.md|LICENSE)$/.test(entry.name)) {
      await Deno.copyFile(source, target);
    }
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}

/** Verify the resolved native SDK, rather than trusting a requested alias. */
export async function checkResolvedSdk(
  source: string,
  selection: string,
): Promise<void> {
  const result = await new Deno.Command(Deno.execPath(), {
    cwd: source,
    args: ["info", "--json", "--config", "deno.json", "fixtures/smoke.ts"],
  }).output();
  if (!result.success) {
    throw new Error(
      `CONSUMER_GRAPH_FAILED: ${new TextDecoder().decode(result.stderr)}`,
    );
  }
  const graph = JSON.parse(new TextDecoder().decode(result.stdout));
  const versions = Object.values(graph.npmPackages ?? {}).filter((
    pkg,
  ): pkg is { name: string; version: string } =>
    typeof pkg === "object" && pkg !== null && "name" in pkg &&
    pkg.name === "@stellar/stellar-sdk"
  ).map((pkg) => pkg.version);
  if (versions.length !== 1 || !accepts(versions[0], selection)) {
    throw new Error(
      `CONSUMER_SDK_GRAPH: expected one SDK matching ${selection}, received ${
        JSON.stringify(versions)
      }`,
    );
  }
  console.log(
    `Resolved native Stellar SDK ${
      versions[0]
    } (selection ${selection}); one package instance.`,
  );
}

/** No workspace members: scopes choose the actual Core source for each graph. */
export async function configureSource(
  source: string,
  inventory: WorkspacePackage[],
  sdk: string,
  packageRootImports: Record<string, Record<string, string>> = {},
): Promise<void> {
  const current = JSON.parse(
    await Deno.readTextFile(resolve(root, "deno.json")),
  );
  const imports: Record<string, string> = {
    "@std/toml": current.imports["@std/toml"],
    crypto: current.imports.crypto,
    "stellar-sdk": `npm:@stellar/stellar-sdk@${sdk}`,
    "stellar-sdk/base": `npm:@stellar/stellar-sdk@${sdk}/base`,
    "stellar-sdk/xdr": `npm:@stellar/stellar-sdk@${sdk}/xdr`,
    "stellar-sdk/rpc": `npm:@stellar/stellar-sdk@${sdk}/rpc`,
    "stellar-sdk/contract": `npm:@stellar/stellar-sdk@${sdk}/contract`,
    convee: current.imports.convee,
  };
  for (const pkg of inventory) {
    for (const [name, path] of Object.entries(pkg.exports)) {
      const specifier = `${pkg.name}${name === "." ? "" : name.slice(1)}`;
      imports[specifier] = pathToFileURL(resolve(source, pkg.root, path)).href;
      imports[`jsr:${specifier}`] = imports[specifier];
    }
  }
  const scopes: Record<string, Record<string, string>> = {};
  for (const pkg of inventory) {
    const directory = resolve(source, pkg.root);
    const member = JSON.parse(
      await Deno.readTextFile(resolve(directory, "deno.json")),
    );
    const scoped: Record<string, string> = {};
    for (
      const [name, value] of Object.entries({
        ...(packageRootImports[pkg.name] ?? current.imports),
        ...member.imports,
      }) as [string, string][]
    ) {
      if (
        name.includes("colibri-internal") || name.includes("colibri-tools") ||
        name.startsWith("jsr:@colibri/")
      ) continue;
      if (name in imports && name !== "convee") continue;
      // Local aliases are relative to the member; root-only relative aliases
      // are repository tooling and are deliberately not copied to consumers.
      if (value.startsWith(".") && !(name in (member.imports ?? {}))) continue;
      scoped[name] = value.startsWith(".")
        ? pathToFileURL(resolve(directory, value)).href +
          (value.endsWith("/") ? "/" : "")
        : value;
    }
    // The SDK selection must also override Identicon's package-level alias.
    scoped["stellar-sdk"] = `npm:@stellar/stellar-sdk@${sdk}`;
    scoped["stellar-sdk/base"] = `npm:@stellar/stellar-sdk@${sdk}/base`;
    scoped["stellar-sdk/xdr"] = `npm:@stellar/stellar-sdk@${sdk}/xdr`;
    scoped["stellar-sdk/rpc"] = `npm:@stellar/stellar-sdk@${sdk}/rpc`;
    scoped["stellar-sdk/contract"] = `npm:@stellar/stellar-sdk@${sdk}/contract`;
    // Plain import maps do not provide deno.json's package-subpath expansion
    // consistently across supported runtimes. Spell out every used subpath.
    for (const specifier of await runtimeImports(directory)) {
      for (const [alias, value] of Object.entries(scoped)) {
        if (/^(?:jsr|npm):/.test(value) && specifier.startsWith(`${alias}/`)) {
          scoped[specifier] = `${value}/${specifier.slice(alias.length + 1)}`;
        }
      }
    }
    for (const [name, value] of Object.entries(imports)) {
      if (name.startsWith("@colibri/") || name.startsWith("jsr:@colibri/")) {
        scoped[name] = value;
      }
    }
    scopes[pathToFileURL(directory).href + "/"] = scoped;
  }
  await writeJson(resolve(source, "imports.json"), { imports, scopes });
  await writeJson(resolve(source, "deno.json"), {
    importMap: "./imports.json",
    nodeModulesDir: "auto",
    minimumDependencyAge: { age: "P1D", exclude: ["jsr:@fifo/convee"] },
    compilerOptions: { skipLibCheck: true },
  });
}

export async function prepareSource(
  source: string,
  sdk: string,
): Promise<WorkspacePackage[]> {
  const inventory = await readPackageInventory(root);
  await Deno.mkdir(source, { recursive: true });
  for (const pkg of inventory) {
    await copyRuntime(resolve(root, pkg.root), resolve(source, pkg.root));
  }
  await configureSource(source, inventory, sdk);
  await copyConsumerFixtures(resolve(source, "fixtures"));
  return inventory;
}
