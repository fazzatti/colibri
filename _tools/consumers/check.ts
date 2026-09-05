/** Isolated consumer checks. Produces temporary test artifacts, never publishes. */
import { build } from "jsr:@deno/dnt@0.43.2";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readPackageInventory } from "../package-inventory.ts";

const root = resolve(import.meta.dirname!, "../..");
const temporary = await Deno.makeTempDir({ prefix: "colibri-consumers-" });
const sourceRoot = resolve(temporary, "source");
const inventory = await readPackageInventory(root);
const browserPackages = inventory.filter((pkg) =>
  !["@colibri/build-verification", "@colibri/test-tooling"].includes(pkg.name)
);
const rootConfig = JSON.parse(
  await Deno.readTextFile(resolve(root, "deno.json")),
);

async function command(
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
    throw new Error(`${executable} ${args.join(" ")} failed (${result.code})`);
  }
}

async function copyRuntime(from: string, to: string): Promise<void> {
  await Deno.mkdir(to, { recursive: true });
  for await (const entry of Deno.readDir(from)) {
    if (
      ["node_modules", ".git"].includes(entry.name) ||
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

try {
  // No _internal, _tools, local node_modules, or workspace Colibri redirects.
  // Package-local aliases remain exactly as declared by each member manifest.
  await Deno.mkdir(sourceRoot, { recursive: true });
  const imports = Object.fromEntries(
    Object.entries(rootConfig.imports).filter(([name]) =>
      !name.includes("colibri") &&
      !["archunit", "crap4ts-tool", "resvg-test"].includes(name)
    ),
  );
  imports["stellar-sdk"] = `npm:@stellar/stellar-sdk@${
    Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1"
  }`;
  await Deno.writeTextFile(
    resolve(sourceRoot, "deno.json"),
    JSON.stringify({
      workspace: inventory.map((pkg) => `./${pkg.root}`),
      imports,
      nodeModulesDir: "auto",
      compilerOptions: { skipLibCheck: true },
    }),
  );
  for (const pkg of inventory) {
    await copyRuntime(resolve(root, pkg.root), resolve(sourceRoot, pkg.root));
  }
  const smoke = await Deno.readTextFile(
    resolve(import.meta.dirname!, "smoke.ts"),
  );
  await Deno.writeTextFile(resolve(sourceRoot, "smoke.ts"), smoke);
  const entrypoints = inventory.flatMap((pkg) =>
    Object.values(pkg.exports).map((path) => `${pkg.root}/${path}`)
  );
  await command(
    Deno.execPath(),
    ["check", ...entrypoints, "smoke.ts"],
    sourceRoot,
  );
  await command(Deno.execPath(), ["run", "-A", "smoke.ts"], sourceRoot);

  const artifacts = new Map<string, string>();
  // Core first; all other browser-capable packages depend only on Core.
  browserPackages.sort((a, b) =>
    Number(b.name === "@colibri/core") - Number(a.name === "@colibri/core")
  );
  for (const pkg of browserPackages) {
    const outDir = resolve(
      temporary,
      "npm",
      pkg.name.slice("@colibri/".length),
    );
    const mappings = pkg.name === "@colibri/core" ? {} : {
      [pathToFileURL(resolve(sourceRoot, "core/mod.ts")).href]: {
        name: "@colibri/core",
        version: `file:${artifacts.get("@colibri/core")}`,
      },
    };
    await build({
      cwd: sourceRoot,
      entryPoints: Object.entries(pkg.exports).map(([name, path]) => ({
        name,
        path: resolve(sourceRoot, pkg.root, path),
      })),
      outDir,
      mappings,
      shims: {},
      test: false,
      scriptModule: false,
      compilerOptions: {
        target: "ES2023",
        lib: ["ESNext", "DOM", "DOM.Iterable"],
      },
      package: { name: pkg.name, version: pkg.version, private: true },
    });
    const packed = await new Deno.Command("npm", {
      args: ["pack", "--json", "--ignore-scripts"],
      cwd: outDir,
    }).output();
    if (!packed.success) {
      throw new Error(new TextDecoder().decode(packed.stderr));
    }
    const [{ filename }] = JSON.parse(new TextDecoder().decode(packed.stdout));
    artifacts.set(pkg.name, resolve(outDir, filename));
  }
  const consumer = resolve(temporary, "consumer");
  await Deno.mkdir(consumer);
  await Deno.writeTextFile(
    resolve(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await command("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...artifacts.values(),
    `@stellar/stellar-sdk@${Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1"}`,
    "typescript@5.9.3",
    "esbuild@0.28.2",
  ], consumer);
  await Deno.writeTextFile(
    resolve(consumer, "smoke.ts"),
    smoke.replaceAll('"stellar-sdk', '"@stellar/stellar-sdk'),
  );
  await command("npx", [
    "--no-install",
    "tsc",
    "smoke.ts",
    "--outDir",
    "out",
    "--module",
    "nodenext",
    "--target",
    "ES2023",
    "--strict",
    "--skipLibCheck",
  ], consumer);
  await command("node", ["out/smoke.js"], consumer);
  await command("npx", [
    "--no-install",
    "esbuild",
    "smoke.ts",
    "--bundle",
    "--platform=browser",
    "--format=esm",
    "--outfile=browser.js",
  ], consumer);
  console.log(
    "Installed npm tarballs and browser bundling passed. JSR registry-generated tarballs remain a post-publication check.",
  );
} finally {
  await Deno.remove(temporary, { recursive: true });
}
