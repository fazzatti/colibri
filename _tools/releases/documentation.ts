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
