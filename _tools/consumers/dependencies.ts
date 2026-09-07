/** Validate advertised Core ranges using immutable release trees, not workspace linking. */
import { compare, parse } from "jsr:@std/semver@1.0.5";
import { resolve } from "node:path";
import { accepts } from "../releases/model.ts";
import { colibriDependencies, git } from "../releases/repository.ts";
import { restorePackage } from "./release-tree.ts";
import {
  readPackageInventory,
  type WorkspacePackage,
} from "../package-inventory.ts";
import {
  command,
  configureSource,
  prepareSource,
  root,
} from "./environment.ts";

const sdk = Deno.env.get("STELLAR_SDK_VERSION") ?? "17.0.1";
const inventory = await readPackageInventory(root);
const core = inventory.find((pkg) => pkg.name === "@colibri/core")!;

async function versions(
  prefix: string,
): Promise<{ version: string; ref: string }[]> {
  const tags = (await git(root, "tag", "--list", `${prefix}-*`)).split("\n")
    .filter(Boolean);
  return tags.map((ref) => ({ version: ref.slice(prefix.length + 1), ref }))
    .filter(({ version }) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => compare(parse(a.version), parse(b.version)));
}

async function checkPackage(
  pkg: WorkspacePackage,
  coreRef?: string,
  dependentRef?: string,
): Promise<void> {
  const source = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "colibri-core-range-" }),
  );
  try {
    await prepareSource(source, sdk);
    const roots: Record<string, Record<string, string>> = {};
    if (coreRef) {
      roots[core.name] = await restorePackage(root, source, core.root, coreRef);
    }
    if (dependentRef) {
      roots[pkg.name] = await restorePackage(
        root,
        source,
        pkg.root,
        dependentRef,
      );
    }
    await configureSource(source, inventory, sdk, roots);
    const manifest = JSON.parse(
      await Deno.readTextFile(resolve(source, pkg.root, "deno.json")),
    );
    const selectedCore = JSON.parse(
      await Deno.readTextFile(resolve(source, core.root, "deno.json")),
    );
    const range = colibriDependencies(manifest)[core.name];
    if (!accepts(selectedCore.version, range)) {
      throw new Error(
        `CONSUMER_CORE_RANGE: ${pkg.name}@${manifest.version} ${range} does not accept ${selectedCore.version}`,
      );
    }
    const exports: Record<string, string> = typeof manifest.exports === "string"
      ? { ".": manifest.exports }
      : manifest.exports;
    const entrypoints = Object.values(exports).map((entry) =>
      `${pkg.root}/${entry}`
    );
    // Check all implementation types against the selected released Core, then
    // execute each public entrypoint so missing runtime exports also fail.
    await command(Deno.execPath(), [
      "check",
      "--config",
      "deno.json",
      ...entrypoints,
      "fixtures/extensions.ts",
    ], source);
    await Deno.writeTextFile(
      resolve(source, "load-package.ts"),
      Object.keys(exports).map((name) =>
        `import * as entry${Object.keys(exports).indexOf(name)} from ${
          JSON.stringify(pkg.name + (name === "." ? "" : name.slice(1)))
        };\nconsole.log(Object.keys(entry${
          Object.keys(exports).indexOf(name)
        }).length);`
      ).join("\n"),
    );
    await command(Deno.execPath(), [
      "run",
      "-A",
      "--config",
      "deno.json",
      "load-package.ts",
    ], source);
    await command(Deno.execPath(), [
      "run",
      "-A",
      "--config",
      "deno.json",
      "fixtures/extensions.ts",
    ], source);
    console.log(
      `${pkg.name}@${manifest.version} -> Core ${selectedCore.version}; sources: ${
        dependentRef ?? "candidate"
      } / ${coreRef ?? "candidate"}; no workspace substitution`,
    );
  } finally {
    await Deno.remove(source, { recursive: true });
  }
}

const coreVersions = [...await versions("core"), {
  version: core.version,
  ref: "",
}]
  .sort((a, b) => compare(parse(a.version), parse(b.version)));
for (const pkg of inventory) {
  const manifest = JSON.parse(
    await Deno.readTextFile(resolve(root, pkg.root, "deno.json")),
  );
  const range = colibriDependencies(manifest)[core.name];
  if (!range) continue;
  const minimum = coreVersions.find(({ version }) => accepts(version, range));
  if (!minimum) {
    throw new Error(`CONSUMER_NO_COMPATIBLE_CORE: ${pkg.name} ${range}`);
  }
  if (!minimum.ref) {
    console.log(
      `First compatible Core release is this candidate (${core.version}); no older compatible release exists yet.`,
    );
  }
  await checkPackage(pkg, minimum.ref || undefined);
  // Keep the earliest still-compatible dependent release as a regression case.
  let historical: string | undefined;
  for (const { ref } of await versions(pkg.name.slice("@colibri/".length))) {
    const published = JSON.parse(
      await git(root, "show", `${ref}:${pkg.root}/deno.json`),
    );
    const publishedRange = colibriDependencies(published)[core.name];
    if (publishedRange && accepts(core.version, publishedRange)) {
      historical = ref;
      break;
    }
  }
  if (historical) await checkPackage(pkg, undefined, historical);
  else {console.log(
      `${pkg.name}: establishing the first release compatible with Core ${core.version}; reverse historical lane starts after publication.`,
    );}
}
