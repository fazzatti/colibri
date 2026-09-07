/** Restore an immutable package tree into an owned, disposable consumer graph. */
import { resolve } from "node:path";
import { git } from "../releases/repository.ts";

export async function restorePackage(
  repository: string,
  source: string,
  packageRoot: string,
  ref: string,
): Promise<Record<string, string>> {
  const archive = await new Deno.Command("git", {
    cwd: repository,
    args: ["archive", ref, "--", packageRoot],
  }).output();
  if (!archive.success) {
    throw new Error(`CONSUMER_ARCHIVE_FAILED: ${ref} ${packageRoot}`);
  }
  await Deno.remove(resolve(source, packageRoot), { recursive: true });
  const tar = new Deno.Command("tar", {
    args: ["-xf", "-", "-C", source],
    stdin: "piped",
  }).spawn();
  const writer = tar.stdin.getWriter();
  await writer.write(archive.stdout);
  await writer.close();
  if (!(await tar.status).success) {
    throw new Error(`CONSUMER_EXTRACT_FAILED: ${ref}`);
  }
  return JSON.parse(await git(repository, "show", `${ref}:deno.json`)).imports;
}
