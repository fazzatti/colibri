/** Repository-only inventory derived from workspace members and package exports. */
import { isAbsolute, relative, resolve } from "node:path";

export type WorkspacePackage = {
  root: string;
  name: string;
  version: string;
  exports: Record<string, string>;
};

export async function readPackageInventory(
  root: string,
): Promise<WorkspacePackage[]> {
  const workspace = JSON.parse(
    await Deno.readTextFile(resolve(root, "deno.json")),
  );
  const directories = new Set<string>();
  for (const member of workspace.workspace as string[]) {
    if (!member.endsWith("/*")) {
      directories.add(resolve(root, member));
      continue;
    }
    const parent = resolve(root, member.slice(0, -2));
    for await (const entry of Deno.readDir(parent)) {
      if (entry.isDirectory) directories.add(resolve(parent, entry.name));
    }
  }
  return await Promise.all(
    [...directories].sort().map(async (directory) => {
      const manifest = JSON.parse(
        await Deno.readTextFile(resolve(directory, "deno.json")),
      );
      const exports: Record<string, string> =
        typeof manifest.exports === "string"
          ? { ".": manifest.exports }
          : manifest.exports;
      if (
        !manifest.name || !manifest.version || !exports ||
        !Object.keys(exports).length
      ) {
        throw new Error(`Incomplete published package manifest: ${directory}`);
      }
      for (const value of Object.values(exports)) {
        const path = relative(directory, resolve(directory, value));
        if (isAbsolute(path) || path === ".." || path.startsWith("../")) {
          throw new Error(`Export escapes package: ${manifest.name} ${value}`);
        }
        await Deno.stat(resolve(directory, value));
      }
      return {
        root: relative(root, directory),
        name: manifest.name,
        version: manifest.version,
        exports,
      };
    }),
  );
}

export function packageEntrypoints(
  packages: readonly WorkspacePackage[],
): string[] {
  return [
    ...new Set(
      packages.flatMap((pkg) =>
        Object.values(pkg.exports).map((path) =>
          `${pkg.root}/${path.replace(/^\.\//, "")}`
        )
      ),
    ),
  ].sort();
}

if (import.meta.main) {
  const mode = Deno.args[0];
  if (mode !== "check" && mode !== "doc") {
    throw new Error("Expected check or doc");
  }
  const root = resolve(import.meta.dirname!, "..");
  const entrypoints = packageEntrypoints(await readPackageInventory(root));
  console.log(
    `Checking ${entrypoints.length} declared package entrypoints (${mode}).`,
  );
  for (const entrypoint of entrypoints) {
    const result = await new Deno.Command(Deno.execPath(), {
      args: mode === "doc"
        ? ["doc", "--lint", entrypoint]
        : ["check", entrypoint],
      cwd: root,
    }).output();
    await Deno.stdout.write(result.stdout);
    await Deno.stderr.write(result.stderr);
    if (!result.success) Deno.exit(result.code);
  }
}
