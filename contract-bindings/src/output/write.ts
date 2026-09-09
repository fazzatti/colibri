import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { GeneratedBindings } from "@/types.ts";
import { GENERATED_MARKER } from "@/generation/generate.ts";
import { BindingError, Code } from "@/error.ts";

/** Options for writing a rendered plan; scaffold files are always preserved. */
export type WriteBindingsOptions = { directory: string; force?: boolean };
/** Paths written or preserved, relative to the requested output directory. */
export type WriteBindingsResult = { written: string[]; preserved: string[] };
async function stat(path: string): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.lstat(path);
  } catch (cause) {
    if (cause instanceof Deno.errors.NotFound) return undefined;
    throw cause;
  }
}
async function safePath(root: string, name: string): Promise<string> {
  const path = resolve(root, name);
  const suffix = relative(root, path);
  if (
    !suffix || isAbsolute(suffix) || suffix === ".." ||
    suffix.startsWith(`..${sep}`)
  ) {
    throw new BindingError(
      Code.OUTPUT_FAILED,
      `Output path escapes destination: ${name}`,
    );
  }
  let current = root;
  for (const segment of suffix.split(sep)) {
    current = resolve(current, segment);
    if ((await stat(current))?.isSymlink) {
      throw new BindingError(
        Code.OUTPUT_FAILED,
        `Refusing symbolic link: ${name}`,
      );
    }
  }
  return path;
}
/** Writes generated files atomically per file, after preflight. Existing scaffold stays untouched. */
export async function writeBindings(
  plan: GeneratedBindings,
  options: WriteBindingsOptions,
): Promise<WriteBindingsResult> {
  try {
    const root = resolve(options.directory);
    if ((await stat(root))?.isSymlink) {
      throw new BindingError(
        Code.OUTPUT_FAILED,
        "Output directory must not be a symbolic link",
      );
    }
    const written: string[] = [], preserved: string[] = [];
    const pending: { path: string; name: string; source: string }[] = [];
    for (const [name, source] of Object.entries(plan.files)) {
      const path = await safePath(root, name);
      if (await stat(path)) {
        if (!options.force) {
          throw new BindingError(
            Code.OUTPUT_FAILED,
            `Already exists: ${name}. Use --force to regenerate.`,
          );
        }
        if (!(await Deno.readTextFile(path)).startsWith(GENERATED_MARKER)) {
          throw new BindingError(
            Code.OUTPUT_FAILED,
            `Refusing to overwrite handwritten file: ${name}`,
          );
        }
      }
      pending.push({ path, name, source });
    }
    for (const [name, source] of Object.entries(plan.scaffold)) {
      if (name in plan.files) {
        throw new BindingError(
          Code.OUTPUT_FAILED,
          `Duplicate output path: ${name}`,
        );
      }
      const path = await safePath(root, name);
      if (await stat(path)) preserved.push(name);
      else pending.push({ path, name, source });
    }
    for (const { path, name, source } of pending) {
      await Deno.mkdir(dirname(path), { recursive: true });
      const temporary = await Deno.makeTempFile({
        dir: dirname(path),
        prefix: ".colibri-",
      });
      try {
        await Deno.writeTextFile(temporary, source);
        await Deno.rename(temporary, path);
        written.push(name);
      } finally {
        if (await stat(temporary)) await Deno.remove(temporary);
      }
    }
    return { written, preserved };
  } catch (cause) {
    if (cause instanceof BindingError) throw cause;
    throw new BindingError(
      Code.OUTPUT_FAILED,
      "Could not write generated bindings",
      cause,
    );
  }
}
