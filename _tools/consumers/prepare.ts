/** Build portable pre-publication npm test artifacts once per SDK selection. */
import { build } from "jsr:@deno/dnt@0.43.2";
import { compare, parse } from "jsr:@std/semver@1.0.5";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { accepts } from "../releases/model.ts";
import { colibriDependencies, runtimeImports } from "../releases/repository.ts";
import {
  command,
  copyRuntime,
  denoOnlyEntrypoints,
  dockerPackages,
  fixtureRoot,
  prepareSource,
  root,
  writeJson,
} from "./environment.ts";

export async function resolveSdk(selection: string): Promise<string> {
  const result = await new Deno.Command("npm", {
    args: ["view", `@stellar/stellar-sdk@${selection}`, "version", "--json"],
  }).output();
  if (!result.success) {
    throw new Error(
      `CONSUMER_SDK_LOOKUP: ${new TextDecoder().decode(result.stderr)}`,
    );
  }
  const data = JSON.parse(new TextDecoder().decode(result.stdout));
  const versions: string[] = typeof data === "string" ? [data] : data;
  const sdk = versions.sort((a, b) => compare(parse(a), parse(b))).at(-1)!;
  if (!accepts(sdk, ">=17.0.1 <18")) {
    throw new Error(`CONSUMER_SDK_UNSUPPORTED: ${sdk}`);
  }
  console.log(`Selected native Stellar SDK ${sdk} from ${selection}`);
  return sdk;
}

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
    const browserPackages = inventory.filter((pkg) =>
      !dockerPackages.has(pkg.name)
    ).sort((a, b) =>
      Number(b.name === "@colibri/core") - Number(a.name === "@colibri/core")
    );
    const artifacts = new Map<string, string>();
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
        ...(pkg.name === "@colibri/core" ? {} : Object.fromEntries(
          Object.entries(
            inventory.find((item) => item.name === "@colibri/core")!.exports,
          )
            .filter(([name]) =>
              packageImports.has(
                `@colibri/core${name === "." ? "" : name.slice(1)}`,
              )
            )
            .map((
              [name, entry],
            ) => [pathToFileURL(resolve(source, "core", entry)).href, {
              name: "@colibri/core",
              version: `file:${artifacts.get("@colibri/core")}`,
              ...(name === "." ? {} : { subPath: name.slice(2) }),
            }]),
        )),
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
          lib: ["ESNext", "DOM", "DOM.Iterable"],
        },
        package: { name: pkg.name, version: pkg.version, private: true },
      });
      // dnt uses a local Core tarball to build declarations. Portable artifacts
      // retain the advertised range and are installed together by the consumer.
      const manifestPath = resolve(outDir, "package.json");
      const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
      const original = JSON.parse(
        await Deno.readTextFile(resolve(root, pkg.root, "deno.json")),
      );
      if (manifest.dependencies?.["@colibri/core"]) {
        manifest.dependencies["@colibri/core"] =
          colibriDependencies(original)["@colibri/core"];
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
    }
    await copyRuntime(fixtureRoot, resolve(destination, "fixtures"));
    await writeJson(resolve(destination, "manifest.json"), {
      sdk,
      convee: config.imports.convee,
      packages: browserPackages.map((pkg) => ({
        name: pkg.name,
        version: pkg.version,
        archive: artifacts.get(pkg.name)!.split("/").at(-1),
      })),
    });
    await command(Deno.execPath(), [
      "check",
      "--config",
      "deno.json",
      ...inventory.flatMap((pkg) =>
        Object.values(pkg.exports).map((entry) => `${pkg.root}/${entry}`)
      ),
      "fixtures/smoke.ts",
      "fixtures/extensions.ts",
    ], source);
    console.log(`Prepared portable consumer artifacts in ${destination}`);
  } finally {
    await Deno.remove(temporary, { recursive: true });
  }
}

if (import.meta.main) {
  await prepareArtifacts(
    resolve(Deno.args[0] ?? "_artifacts/consumers"),
    Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1",
  );
}
