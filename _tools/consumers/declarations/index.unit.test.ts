import { assertEquals, assertRejects } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { resolve } from "node:path";
import ts from "npm:typescript@5.9.3";
import { command, root } from "../environment.ts";
import { emitterBinary, emitterManifest, emitterTarget } from "./index.ts";
import { rewriteImports } from "./imports.ts";
import { replaceDeclarations } from "./package.ts";

async function emit(source: string): Promise<string> {
  const specifier = "file:///candidate/mod.ts";
  const child = new Deno.Command(emitterBinary, {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(
    new TextEncoder().encode(
      JSON.stringify({
        roots: [specifier],
        modules: { [specifier]: source },
        externals: [],
        resolutions: {},
        packages: [{
          base: "file:///candidate/",
          name: "@test/package",
          version: "1.0.0",
          exports: { ".": "./mod.ts" },
        }],
      }),
    ),
  );
  await writer.close();
  const result = await child.output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return JSON.parse(new TextDecoder().decode(result.stdout))
    .declarations[specifier];
}

async function diagnostics(declaration: string): Promise<number[]> {
  const directory = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(resolve(directory, "mod.d.ts"), declaration);
    const file = resolve(directory, "consumer.ts");
    await Deno.writeTextFile(
      file,
      `
import { StrKey } from "./mod.js";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type EncodeType = Assert<Equal<typeof StrKey.encode, (value: string) => string>>;
const result: string = StrKey.encode("hello");
// @ts-expect-error Numbers must remain invalid; any would hide this regression.
StrKey.encode(123);
`,
    );
    const program = ts.createProgram([file], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2023,
    });
    return ts.getPreEmitDiagnostics(program).map((diagnostic) =>
      diagnostic.code
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
}

describe("JSR declaration regression", () => {
  beforeAll(async () => {
    await command("cargo", [
      "build",
      "--locked",
      "--manifest-path",
      emitterManifest,
      "--target-dir",
      emitterTarget,
    ], root);
  });
  it("reproduces dropped spread members and compiles the explicitly typed correction", async () => {
    const members =
      "const members = { encode: (value: string): string => value };";
    const broken = await emit(
      `${members} export const StrKey = { ...members, value: 1 };`,
    );
    assertEquals((await diagnostics(broken)).includes(2339), true);
    const fixed = await emit(
      `${members} export const StrKey: { encode: (value: string) => string; value: number } = { ...members, value: 1 };`,
    );
    assertEquals(await diagnostics(fixed), []);
  });
  it("rejects weakened any declarations instead of treating them as compatible", async () => {
    const codes = await diagnostics(
      "export declare const StrKey: { encode: any };",
    );
    assertEquals(codes.includes(2344), true);
    assertEquals(codes.includes(2578), true);
  });
  it("fails rather than returning declarations for an unresolved export", async () => {
    await assertRejects(() => emit('export * from "./missing.ts";'));
  });
  it("rewrites imports, reexports and import types without changing string literal types", () => {
    const source =
      'import type { T } from "alias"; export { T } from "alias"; export type U = import("alias").T; export type Label = "alias";';
    assertEquals(
      rewriteImports(source, () => "./actual.js"),
      'import type { T } from "./actual.js"; export { T } from "./actual.js"; export type U = import("./actual.js").T; export type Label = "alias";',
    );
  });
  it("removes fallback dnt declarations while preserving runtime JavaScript", async () => {
    const directory = await Deno.makeTempDir();
    try {
      await Deno.mkdir(resolve(directory, "esm"));
      await Deno.writeTextFile(resolve(directory, "esm/mod.js"), "runtime");
      await Deno.writeTextFile(resolve(directory, "esm/mod.d.ts"), "old");
      await Deno.writeTextFile(
        resolve(directory, "esm/stale.d.ts"),
        "fallback",
      );
      await replaceDeclarations(
        directory,
        "core",
        new Map([["core/mod.ts", "candidate"], ["other/mod.ts", "unrelated"]]),
      );
      assertEquals(
        await Deno.readTextFile(resolve(directory, "esm/mod.d.ts")),
        "candidate",
      );
      assertEquals(
        await Deno.readTextFile(resolve(directory, "esm/mod.js")),
        "runtime",
      );
      await assertRejects(
        () => Deno.stat(resolve(directory, "esm/stale.d.ts")),
        Deno.errors.NotFound,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
