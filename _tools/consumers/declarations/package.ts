/** Replace dnt declarations completely, so missing JSR output cannot fall back to them. */
import { dirname, resolve } from "node:path";

export async function replaceDeclarations(
  directory: string,
  packageRoot: string,
  declarations: ReadonlyMap<string, string>,
): Promise<void> {
  async function remove(directory: string): Promise<void> {
    for await (const entry of Deno.readDir(directory)) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory) await remove(path);
      else if (/\.d\.ts(?:\.map)?$/.test(entry.name)) await Deno.remove(path);
    }
  }
  const esm = resolve(directory, "esm");
  await remove(esm);
  for (const [path, source] of declarations) {
    if (!path.startsWith(`${packageRoot}/`)) continue;
    const destination = resolve(
      esm,
      path.slice(packageRoot.length + 1).replace(/\.ts$/, ".d.ts"),
    );
    await Deno.mkdir(dirname(destination), { recursive: true });
    await Deno.writeTextFile(destination, source);
  }
}
