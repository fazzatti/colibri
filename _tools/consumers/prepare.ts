/** Build portable pre-publication npm test artifacts once per SDK selection. */
import { consumerFiles, copyConsumerFixtures } from "./fixtures.ts";
import { checkReactClientDirectives } from "../react-client-directives.ts";
import { emitDeclarations } from "./declarations/index.ts";
import { replaceDeclarations } from "./declarations/package.ts";
import { build } from "jsr:@deno/dnt@0.43.2";
import { resolveSdk } from "./sdk.ts";
export { resolveSdk } from "./sdk.ts";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { colibriDependencies, runtimeImports } from "../releases/repository.ts";
import {
  command,
  denoOnlyEntrypoints,
  dockerPackages,
  prepareSource,
  root,
  writeJson,
} from "./environment.ts";

export async function prepareArtifacts(
  destination: string,
  sdkSelection: string,
): Promise<void> {
  const sdk = await resolveSdk(sdkSelection);
  const temporary = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "colibri-artifacts-" }),
  );
  try {
    const source = resolve(temporary, "source");
    const inventory = await prepareSource(source, sdk);
    const config = JSON.parse(
      await Deno.readTextFile(resolve(root, "deno.json")),
    );
    const conveeVersion = config.imports.convee.split("@").at(-1);
    const conveeMetadata = await fetch(
      `https://jsr.io/@fifo/convee/${conveeVersion}_meta.json`,
    );
    if (!conveeMetadata.ok) {
      throw new Error(
        `CONSUMER_CONVEE_METADATA: HTTP ${conveeMetadata.status}`,
      );
    }
    const conveeEntry = (await conveeMetadata.json()).exports["."].replace(
      /^\.\//,
      "",
    );
    await Deno.mkdir(destination, { recursive: true });
    const pending = inventory.filter((pkg) =>
      pkg.name === "@colibri/test-tooling" || !dockerPackages.has(pkg.name)
    );
    const browserPackages: typeof inventory = [];
    // Packages can now compose several Colibri packages. Build dependencies first.
    const dependencies = new Map<string, string[]>();
    for (const pkg of pending) {
      const manifest = JSON.parse(
        await Deno.readTextFile(resolve(root, pkg.root, "deno.json")),
      );
      dependencies.set(pkg.name, Object.keys(colibriDependencies(manifest)));
    }
    while (pending.length) {
      const index = pending.findIndex((pkg) =>
        dependencies.get(pkg.name)!.every((name) =>
          browserPackages.some((built) => built.name === name)
        )
      );
      if (index < 0) {
        throw new Error(
          "CONSUMER_DEPENDENCY_ORDER: cyclic or unavailable package dependency",
        );
      }
      browserPackages.push(...pending.splice(index, 1));
    }
    const declarations = await emitDeclarations(source, inventory);
    await Deno.copyFile(
      resolve(source, "declaration-diagnostics.json"),
      resolve(destination, "declaration-diagnostics.json"),
    );
    const artifacts = new Map<string, string>();
    const declarationArtifacts = new Map<string, string>();
    for (const pkg of browserPackages) {
      const outDir = resolve(
        temporary,
        "npm",
        pkg.name.slice("@colibri/".length),
      );
      const packageImports = await runtimeImports(resolve(source, pkg.root));
      const usesConvee = packageImports.has("convee");
      const mappings = {
        ...(usesConvee
          ? {
            [`https://jsr.io/@fifo/convee/${conveeVersion}/${conveeEntry}`]: {
              name: "@jsr/fifo__convee",
              version: conveeVersion,
            },
          }
          : {}),
        ...Object.fromEntries(
          inventory.filter((dependency) => dependency.name !== pkg.name)
            .flatMap((dependency) =>
              Object.entries(dependency.exports).filter(([name]) =>
                packageImports.has(
                  `${dependency.name}${name === "." ? "" : name.slice(1)}`,
                )
              ).map(([name, entry]) => [
                pathToFileURL(resolve(source, dependency.root, entry)).href,
                {
                  name: dependency.name,
                  version: `file:${artifacts.get(dependency.name)}`,
                  ...(name === "." ? {} : { subPath: name.slice(2) }),
                },
              ])
            ),
        ),
      };
      await Deno.mkdir(outDir, { recursive: true });
      await Deno.writeTextFile(
        resolve(outDir, ".npmrc"),
        "@jsr:registry=https://npm.jsr.io\n",
      );
      await build({
        cwd: source,
        importMap: resolve(source, "imports.json"),
        entryPoints: Object.entries(pkg.exports).filter(([name]) =>
          !denoOnlyEntrypoints.has(
            `${pkg.name}${name === "." ? "" : name.slice(1)}`,
          )
        ).map(([name, path]) => ({
          name,
          path: resolve(source, pkg.root, path),
        })),
        outDir,
        mappings,
        shims: {},
        test: false,
        scriptModule: false,
        compilerOptions: {
          target: "ES2023",
          ...(pkg.name === "@colibri/test-tooling" ? { types: ["node"] } : {}),
          lib: ["ESNext", "DOM", "DOM.Iterable"],
        },
        package: {
          name: pkg.name,
          version: pkg.version,
          private: true,
          ...(pkg.name === "@colibri/test-tooling"
            ? { devDependencies: { "@types/node": "^22.12.0" } }
            : {}),
          // dnt can infer a caret range from native types behind mapped packages.
          // Every direct SDK consumer in this compatibility lane must use one selection.
          dependencies: [...packageImports].some((name) =>
              name === "stellar-sdk" || name.startsWith("stellar-sdk/")
            )
            ? { "@stellar/stellar-sdk": sdk }
            : {},
        },
      });
      if (pkg.name === "@colibri/react") {
        await checkReactClientDirectives(
          resolve(source, pkg.root, "src"),
          resolve(outDir, "esm", "src"),
        );
      }
      // dnt uses local dependency tarballs to build declarations. Portable artifacts
      // retain the advertised range and are installed together by the consumer.
      const manifestPath = resolve(outDir, "package.json");
      const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
      const original = JSON.parse(
        await Deno.readTextFile(resolve(root, pkg.root, "deno.json")),
      );
      for (
        const [name, range] of Object.entries(colibriDependencies(original))
      ) {
        if (manifest.dependencies?.[name]) manifest.dependencies[name] = range;
      }
      await writeJson(manifestPath, manifest);
      const packed = await new Deno.Command("npm", {
        args: ["pack", "--json", "--ignore-scripts"],
        cwd: outDir,
      }).output();
      if (!packed.success) {
        throw new Error(
          `CONSUMER_PACK_FAILED: ${new TextDecoder().decode(packed.stderr)}`,
        );
      }
      const [{ filename }] = JSON.parse(
        new TextDecoder().decode(packed.stdout),
      );
      const target = resolve(destination, filename);
      await Deno.copyFile(resolve(outDir, filename), target);
      artifacts.set(pkg.name, target);
      // dnt roots the recorder-only artifact at recorder/, since the Docker
      // entrypoint is deliberately excluded from this portable package build.
      const declarationRoot = pkg.name === "@colibri/test-tooling"
        ? `${pkg.root}/recorder`
        : pkg.root;
      await replaceDeclarations(outDir, declarationRoot, declarations);
      await command("npm", ["pack", "--ignore-scripts", "--quiet"], outDir);
      const declarationTarget = resolve(
        destination,
        `jsr-declarations-${filename}`,
      );
      await Deno.copyFile(resolve(outDir, filename), declarationTarget);
      declarationArtifacts.set(pkg.name, declarationTarget);
    }
    await copyConsumerFixtures(resolve(destination, "fixtures"));
    await writeJson(resolve(destination, "manifest.json"), {
      declarations: { denoGraph: "0.111.0", denoAst: "0.53.2" },
      sdk,
      convee: config.imports.convee,
      packages: browserPackages.map((pkg) => ({
        name: pkg.name,
        version: pkg.version,
        archive: artifacts.get(pkg.name)!.split("/").at(-1),
        declarationsArchive: declarationArtifacts.get(pkg.name)!.split("/").at(
          -1,
        ),
      })),
    });
    await command(Deno.execPath(), [
      "check",
      "--config",
      "deno.json",
      ...inventory.flatMap((pkg) =>
        Object.values(pkg.exports).map((entry) => `${pkg.root}/${entry}`)
      ),
      ...consumerFiles.map((name) => `fixtures/${name}`),
    ], source);
    console.log(`Prepared portable consumer artifacts in ${destination}`);
  } finally {
    if (Deno.env.get("COLIBRI_CONSUMER_KEEP_SOURCE") === "1") {
      console.log(`Consumer build diagnostics retained at ${temporary}`);
    } else await Deno.remove(temporary, { recursive: true });
  }
}

if (import.meta.main) {
  await prepareArtifacts(
    resolve(Deno.args[0] ?? "_artifacts/consumers"),
    Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1",
  );
}
