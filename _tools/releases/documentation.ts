import { dirname, resolve } from "node:path";
/** Generate declaration JSON without terminal-dependent presentation escapes. */
export async function generateDocumentation(
  repositoryRoot: string,
  absolute: string,
): Promise<string> {
  const env: Record<string, string> = { ...Deno.env.toObject(), NO_COLOR: "1" };
  // Deno treats even FORCE_COLOR=0 as an override of NO_COLOR.
  delete env.FORCE_COLOR;
  const output = await new Deno.Command(Deno.execPath(), {
    cwd: repositoryRoot,
    args: ["doc", "--json", absolute],
    // Deno can include ANSI colors in template-literal `repr` even in JSON.
    // Disable them at generation; do not strip legitimate literal content.
    clearEnv: true,
    env,
  }).output();
  if (!output.success) {
    throw new Error(
      `API_DOC_FAILED: ${absolute}: ${new TextDecoder().decode(output.stderr)}`,
    );
  }
  return new TextDecoder().decode(output.stdout);
}

/** Resolve a re-exported namespace in its declaring package's alias scope. */
export function declarationImport(
  filename: string,
  imported: string,
  scopes: readonly { directory: string; imports: Record<string, string> }[],
): string | undefined {
  if (imported.startsWith(".")) return resolve(dirname(filename), imported);
  const owner =
    scopes.filter((scope) => filename.startsWith(scope.directory + "/"))
      .sort((a, b) => b.directory.length - a.directory.length)[0];
  if (!owner) return undefined;
  const alias =
    Object.keys(owner.imports).filter((alias) =>
      alias.endsWith("/") && imported.startsWith(alias)
    )
      .sort((a, b) => b.length - a.length)[0];
  if (!alias || !owner.imports[alias].startsWith(".")) return undefined;
  return resolve(
    owner.directory,
    owner.imports[alias],
    imported.slice(alias.length),
  );
}
