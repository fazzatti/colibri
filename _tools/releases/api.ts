/** Generate declarations using one pinned compiler, independent of runtime lanes. */
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPackageInventory } from "../package-inventory.ts";
import {
  type ApiChange,
  type ApiSnapshot,
  compareApis,
  type Json,
  normalizeDeclaration,
} from "./api-model.ts";
import { readPlan } from "./model.ts";
import { generateDocumentation } from "./documentation.ts";
import { git, planPath, repositoryRoot } from "./repository.ts";

const update = Deno.args.includes("--update");
const report = {
  toolchain: Deno.version,
  changes: [] as ApiChange[],
  unreviewed: [] as ApiChange[],
};

type Declaration = {
  location: { filename: string };
  kind: string;
  def: { tsType?: { kind: string; value: string } };
};
type Symbol = { name: string; declarations: Declaration[] };
const cache = new Map<string, Symbol[]>();
async function loadSymbols(absolute: string): Promise<Symbol[]> {
  const known = cache.get(absolute);
  if (known) return known;
  const data = JSON.parse(
    await generateDocumentation(repositoryRoot, absolute),
  );
  if (data.version !== 2) {
    throw new Error("API_SCHEMA: unsupported Deno doc JSON version");
  }
  const symbols = data.nodes[pathToFileURL(absolute).href]?.symbols;
  if (!Array.isArray(symbols)) {
    throw new Error(`API_MISSING_ENTRYPOINT: ${absolute}`);
  }
  cache.set(absolute, symbols);
  return symbols;
}
function symbolMap(symbols: Symbol[]): Record<string, Json> {
  return Object.fromEntries(
    symbols.map((
      symbol,
    ): [string, Json] => [
      symbol.name,
      normalizeDeclaration(
        symbol.declarations as unknown as Json,
        pathToFileURL(repositoryRoot + "/").href,
      ),
    ])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
try {
  if (Deno.version.deno !== "2.9.6") {
    throw new Error(
      "API_TOOLCHAIN: use Deno 2.9.6 to generate or check declaration snapshots",
    );
  }
  const baselinePath = "_tools/releases/public-api.json";
  const packages = await readPackageInventory(repositoryRoot);
  const current: ApiSnapshot = {};
  for (const pkg of packages) {
    const manifest = JSON.parse(
      await Deno.readTextFile(resolve(repositoryRoot, pkg.root, "deno.json")),
    );
    for (const [name, path] of Object.entries(pkg.exports)) {
      const absolute = resolve(repositoryRoot, pkg.root, path);
      const symbols = await loadSymbols(absolute);
      const entrypoint = `${pkg.name}${name === "." ? "" : name.slice(1)}`;
      current[entrypoint] = symbolMap(symbols);
      // `export const BTX_ERRORS: typeof BuildTransactionErrors` is a real
      // public namespace. Deno doc leaves it as a name: include its members too.
      for (const symbol of symbols) {
        for (const declaration of symbol.declarations) {
          const type = declaration.def?.tsType;
          if (
            declaration.kind !== "variable" || type?.kind !== "typeQuery" ||
            !/^\w+$/.test(type.value)
          ) continue;
          const filename = fileURLToPath(declaration.location.filename);
          const source = await Deno.readTextFile(filename);
          const imported = new RegExp(
            `import\\s+\\*\\s+as\\s+${type.value}\\s+from\\s+["']([^"']+)["']`,
          ).exec(source)?.[1];
          if (!imported) continue;
          let target = imported.startsWith(".")
            ? resolve(dirname(filename), imported)
            : undefined;
          for (
            const [alias, value] of Object.entries(manifest.imports ?? {}) as [
              string,
              string,
            ][]
          ) {
            if (
              alias.endsWith("/") && value.startsWith(".") &&
              imported.startsWith(alias)
            ) {
              target = resolve(
                repositoryRoot,
                pkg.root,
                value,
                imported.slice(alias.length),
              );
            }
          }
          if (target) {
            current[entrypoint][`${symbol.name}::members`] = symbolMap(
              await loadSymbols(target),
            );
          }
        }
      }
    }
  }
  const serialized = JSON.stringify(current, null, 2) + "\n";
  if (update) {
    await Deno.writeTextFile(resolve(repositoryRoot, baselinePath), serialized);
    console.log(
      "Public declarations updated. Review the diff and document API decisions in the release plan.",
    );
  } else {
    const approved = JSON.parse(
      await Deno.readTextFile(resolve(repositoryRoot, baselinePath)),
    );
    const unreviewed = compareApis(approved, current);
    report.unreviewed = unreviewed;
    if (unreviewed.length) {
      throw new Error(
        `API_UNREVIEWED: ${
          JSON.stringify(unreviewed)
        }; run release:api:update and review the declaration diff`,
      );
    }
    const plan = readPlan(
      await Deno.readTextFile(resolve(repositoryRoot, planPath)),
    );
    const exists = await git(
      repositoryRoot,
      "ls-tree",
      "--name-only",
      plan.base,
      "--",
      baselinePath,
    );
    const before = exists
      ? JSON.parse(
        await git(repositoryRoot, "show", `${plan.base}:${baselinePath}`),
      )
      : {};
    const changes = compareApis(before, current);
    report.changes = changes;
    for (const pkg of packages) {
      const relevant = changes.filter((change) =>
        change.entrypoint === pkg.name ||
        change.entrypoint.startsWith(`${pkg.name}/`)
      );
      if (!relevant.length) continue;
      const intent = plan.packages[pkg.name];
      if (!intent?.apiReview) {
        throw new Error(`API_REVIEW_MISSING: ${pkg.name}`);
      }
      if (
        relevant.some((change) => change.kind === "removed") &&
        Number(pkg.version.split(".")[0]) > 0 && intent.bump !== "major"
      ) {
        throw new Error(`API_REMOVAL_REQUIRES_MAJOR: ${pkg.name}`);
      }
    }
    console.log(JSON.stringify(report, null, 2));
  }
} catch (error) {
  // Keep stdout machine-readable even when validation stops before completion.
  // Rethrowing preserves the non-zero exit status and the original stderr stack.
  if (!update) {
    console.log(JSON.stringify(
      {
        ...report,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ));
  }
  throw error;
}
