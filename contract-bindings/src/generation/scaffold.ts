import type { Spec } from "@colibri/core";
import { renderGuide } from "@/generation/guide.ts";
import type { GenerateBindingsOptions } from "@/types.ts";
import { validatePackageName } from "@/generation/validation.ts";

const json = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
/** @internal Package scaffolding is created once and preserved during regeneration. */
export function packageScaffold(
  options: GenerateBindingsOptions,
  className: string,
  spec: Spec,
): Record<string, string> {
  const guide = renderGuide(options, className, spec);
  if (options.output !== "package") return { "README.md": guide };
  const name = options.packageName;
  validatePackageName(name, options.target ?? "jsr");
  const common = {
    "mod.ts":
      '/** Generated client exports. Add handwritten exports here.\n * @module */\nexport * from "./generated/index.ts";\n',
    ".gitignore": "node_modules/\ndist/\n",
  };
  if (options.target === "npm") {
    return {
      ...common,
      "package.json": json({
        name,
        version: "0.1.0",
        type: "module",
        files: ["dist", "README.md"],
        exports: { ".": { types: "./dist/mod.d.ts", import: "./dist/mod.js" } },
        scripts: {
          build: "tsc -p tsconfig.json",
          check: "tsc -p tsconfig.json --noEmit",
          prepack: "npm run build",
        },
        dependencies: {
          "@colibri/core": "npm:@jsr/colibri__core@^1.1.0",
        },
        devDependencies: { typescript: "~5.9.3", "@types/node": "^22.0.0" },
        engines: { node: ">=22.12.0" },
      }),
      "tsconfig.json": json({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          declaration: true,
          outDir: "dist",
          rootDir: ".",
          rewriteRelativeImportExtensions: true,
          skipLibCheck: true,
        },
        include: ["mod.ts", "generated/**/*.ts"],
      }),
      ".npmrc": "@jsr:registry=https://npm.jsr.io\n",
      "README.md": guide,
    };
  }
  return {
    ...common,
    "deno.json": json({
      name,
      version: "0.1.0",
      exports: "./mod.ts",
      imports: {
        "@colibri/core": "jsr:@colibri/core@^1.1.0",
      },
      tasks: { check: "deno check mod.ts", fmt: "deno fmt" },
      publish: {
        include: ["mod.ts", "generated/**/*.ts", "README.md", "deno.json"],
      },
    }),
    "README.md": guide,
  };
}
