/** Emit candidate npm declarations with JSR's pinned fast-check generator. */
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { WorkspacePackage } from "../../package-inventory.ts";
import { rewriteImports } from "./imports.ts";
import {
  command,
  denoOnlyEntrypoints,
  dockerPackages,
  root,
  writeJson,
} from "../environment.ts";

export const emitterManifest = resolve(
  import.meta.dirname!,
  "emitter/Cargo.toml",
);
export const emitterTarget = Deno.env.get("CARGO_TARGET_DIR") ??
  resolve(root, "target/declarations");
export const emitterBinary = resolve(
  emitterTarget,
  "debug/colibri-declaration-emitter",
);

type Dependency = {
  specifier: string;
  code?: { specifier?: string };
  type?: { specifier?: string };
};
type Module = {
  specifier: string;
  local?: string;
  dependencies?: Dependency[];
};

export async function emitDeclarations(
  source: string,
  inventory: WorkspacePackage[],
): Promise<Map<string, string>> {
  const packages = inventory.filter((pkg) => !dockerPackages.has(pkg.name)).map(
    (pkg) => ({
      ...pkg,
      exports: Object.fromEntries(
        Object.entries(pkg.exports).filter(([name]) =>
          !denoOnlyEntrypoints.has(
            `${pkg.name}${name === "." ? "" : name.slice(1)}`,
          )
        ),
      ),
    }),
  );
  const roots = packages.flatMap((pkg) =>
    Object.values(pkg.exports).map((entry) =>
      pathToFileURL(resolve(source, pkg.root, entry)).href
    )
  );
  await command("cargo", [
    "build",
    "--locked",
    "--manifest-path",
    emitterManifest,
    "--target-dir",
    emitterTarget,
  ], root);
  const entry = resolve(source, "declaration-entry.ts");
  await Deno.writeTextFile(
    entry,
    roots.map((root) => `import ${JSON.stringify(root)};`).join("\n"),
  );
  const info = await new Deno.Command(Deno.execPath(), {
    args: ["info", "--json", "--config", resolve(source, "deno.json"), entry],
    cwd: source,
  }).output();
  if (!info.success) {
    throw new Error(
      `DECLARATION_GRAPH_FAILED: ${new TextDecoder().decode(info.stderr)}`,
    );
  }
  const graph: { modules: Module[] } = JSON.parse(
    new TextDecoder().decode(info.stdout),
  );
  const prefix = pathToFileURL(source + "/").href;
  const modules: Record<string, string> = {};
  const resolutions: Record<string, Record<string, string>> = {};
  const externals = new Set<string>();
  for (const module of graph.modules) {
    if (!module.specifier.startsWith(prefix)) {
      externals.add(module.specifier);
      continue;
    }
    modules[module.specifier] = await Deno.readTextFile(
      fileURLToPath(module.specifier),
    );
    resolutions[module.specifier] = {};
    for (const dependency of module.dependencies ?? []) {
      const target = dependency.type?.specifier ?? dependency.code?.specifier;
      if (!target) {
        throw new Error(
          `DECLARATION_UNRESOLVED_IMPORT: ${module.specifier} ${dependency.specifier}`,
        );
      }
      resolutions[module.specifier][dependency.specifier] = target;
      if (!target.startsWith(prefix)) externals.add(target);
    }
  }
  const input = {
    roots,
    modules,
    resolutions,
    externals: [...externals],
    packages: packages.map((pkg) => ({
      base: pathToFileURL(resolve(source, pkg.root) + "/").href,
      name: pkg.name,
      version: pkg.version,
      exports: pkg.exports,
    })),
  };
  const process = new Deno.Command(emitterBinary, {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(JSON.stringify(input)));
  await writer.close();
  const result = await process.output();
  if (!result.success) {
    throw new Error(
      `DECLARATION_EMIT_FAILED: ${new TextDecoder().decode(result.stderr)}`,
    );
  }
  const { declarations: emitted, diagnostics }: {
    declarations: Record<string, string>;
    diagnostics: Record<string, string>;
  } = JSON.parse(new TextDecoder().decode(result.stdout));
  await writeJson(resolve(source, "declaration-diagnostics.json"), diagnostics);
  const output = new Map<string, string>();
  for (const [specifier, declaration] of Object.entries(emitted)) {
    const owner = packages.find((pkg) =>
      specifier.startsWith(pathToFileURL(resolve(source, pkg.root) + "/").href)
    );
    if (!owner) throw new Error(`DECLARATION_UNKNOWN_PACKAGE: ${specifier}`);
    const base = pathToFileURL(resolve(source, owner.root) + "/").href;
    const text = rewriteImports(declaration, (name) => {
      const target = resolutions[specifier]?.[name];
      if (!target) {
        throw new Error(`DECLARATION_UNKNOWN_IMPORT: ${specifier} ${name}`);
      }
      if (target.startsWith(base)) {
        const path = relative(
          dirname(fileURLToPath(specifier)),
          fileURLToPath(target),
        ).replace(/\.ts$/, ".js");
        return path.startsWith(".") ? path : `./${path}`;
      }
      for (const pkg of packages) {
        for (const [entry, path] of Object.entries(pkg.exports)) {
          if (target === pathToFileURL(resolve(source, pkg.root, path)).href) {
            return `${pkg.name}${entry === "." ? "" : entry.slice(1)}`;
          }
        }
      }
      if (target.startsWith("node:")) return target;
      const npm = /^npm:\/*((?:@[^/]+\/)?[^/@]+)(?:@[^/]+)?(.*)$/.exec(target);
      if (npm) return npm[1] + npm[2];
      if (name === "convee") return "@jsr/fifo__convee";
      throw new Error(
        `DECLARATION_EXTERNAL_IMPORT: ${specifier} ${name} -> ${target}`,
      );
    });
    output.set(relative(source, fileURLToPath(specifier)), text);
  }
  return output;
}

if (import.meta.main) {
  const { prepareSource } = await import("../environment.ts");
  const destination = resolve(Deno.args[0]);
  const source = resolve(destination, "source");
  const inventory = await prepareSource(source, "17.0.1");
  const output = await emitDeclarations(source, inventory);
  for (const [name, text] of output) {
    const path = resolve(
      destination,
      "declarations",
      name.replace(/\.ts$/, ".d.ts"),
    );
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, text);
  }
  await writeJson(resolve(destination, "emitter.json"), {
    denoGraph: "0.111.0",
    denoAst: "0.53.2",
    declarations: output.size,
  });
}
