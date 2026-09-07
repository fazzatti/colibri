/** Repository adapter. Git is read-only here; publishing is never performed. */
import { resolve } from "node:path";
import { readPackageInventory } from "../package-inventory.ts";
import { type PackageState, type ReleasePlan } from "./model.ts";

export const repositoryRoot = resolve(import.meta.dirname!, "../..");
export const planPath = "_tools/releases/plan.json";

export async function git(root: string, ...args: string[]): Promise<string> {
  const result = await new Deno.Command("git", { cwd: root, args }).output();
  if (!result.success) {
    throw new Error(
      `RELEASE_GIT_FAILED: ${new TextDecoder().decode(result.stderr)}`,
    );
  }
  return new TextDecoder().decode(result.stdout).trim();
}

type Manifest = { imports?: Record<string, string> };
export function colibriDependencies(
  manifest: Manifest,
): Record<string, string> {
  return Object.fromEntries(
    Object.values(manifest.imports ?? {}).flatMap((value) => {
      const match = /^jsr:(@colibri\/[^@/]+)@([^/]+)$/.exec(value);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
}

export async function runtimeImports(directory: string): Promise<Set<string>> {
  const imports = new Set<string>();
  for await (const entry of Deno.readDir(directory)) {
    if (
      ["node_modules", ".git", "coverage", "dist"].includes(entry.name) ||
      entry.name.endsWith(".test.ts")
    ) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory) {
      for (const name of await runtimeImports(path)) imports.add(name);
    } else if (entry.isFile && entry.name.endsWith(".ts")) {
      const source = await Deno.readTextFile(path);
      for (
        const match of source.matchAll(
          /(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g,
        )
      ) {
        imports.add(match[1]);
      }
    }
  }
  return imports;
}

export async function packageStates(
  root: string,
  plan: ReleasePlan,
): Promise<PackageState[]> {
  const inventory = await readPackageInventory(root);
  const changed = (await git(root, "diff", "--name-only", plan.base, "--"))
    .split("\n");
  // Include new files before they have been staged.
  changed.push(
    ...(await git(root, "ls-files", "--others", "--exclude-standard")).split(
      "\n",
    ),
  );
  const currentRoot = JSON.parse(
    await Deno.readTextFile(resolve(root, "deno.json")),
  );
  const previousRoot = JSON.parse(
    await git(root, "show", `${plan.base}:deno.json`),
  );
  return await Promise.all(inventory.map(async (pkg) => {
    const path = `${pkg.root}/deno.json`;
    const current = JSON.parse(await Deno.readTextFile(resolve(root, path)));
    const previous = JSON.parse(
      await git(root, "show", `${plan.base}:${path}`),
    );
    const used = await runtimeImports(resolve(root, pkg.root));
    const aliases = new Set([
      ...Object.keys(currentRoot.imports),
      ...Object.keys(previousRoot.imports),
    ]);
    const dependencyChanged = [...aliases].some((alias) => {
      const before = previous.imports?.[alias] ?? previousRoot.imports[alias];
      const after = current.imports?.[alias] ?? currentRoot.imports[alias];
      return before !== after &&
        [...used].some((specifier) =>
          specifier === alias ||
          specifier.startsWith(`${alias.replace(/\/$/, "")}/`)
        );
    });
    return {
      name: pkg.name,
      root: pkg.root,
      version: pkg.version,
      previousVersion: previous.version,
      dependencies: colibriDependencies(current),
      changed: dependencyChanged ||
        changed.some((file) =>
          file.startsWith(`${pkg.root}/`) && !file.endsWith(".test.ts") &&
          /(?:\.ts|deno\.json|README\.md|LICENSE)$/.test(file)
        ),
    };
  }));
}
