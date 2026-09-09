import type { GenerateBindingsOptions } from "@/types.ts";
import { BindingError, Code } from "@/error.ts";

const json = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
/** @internal Package scaffolding is created once and preserved during regeneration. */
export function packageScaffold(
  options: GenerateBindingsOptions,
  className: string,
): Record<string, string> {
  const guide =
    `# ${className}\n\nGenerated Colibri bindings. Keep application setup outside the generated bindings file.\n\nThe spec cannot identify reads versus writes. Use client.read({ method, methodArgs }) to simulate, or client.invoke({ method, methodArgs, config }) to submit through Colibri. Every ABI method is available in both modes. Invoke preserves Core metadata and raw returnValue, and adds decoded value (undefined when no return value is available).\n\nIntegers of 64 bits and above are bigint. Options decode to null. Maps decode to arrays of [key, value] tuples; inputs also accept Map. Void results are null. Bytes are Uint8Array; the codec validates fixed lengths. Top-level Result uses the Stellar SDK Result wrapper. Transaction failures can still throw typed Colibri errors. A result-decoding failure after a successful invoke throws CBG_006 with the original transaction in meta.data.result; do not automatically resubmit.\n\nThe exported error map is installed once in the constructor. Prepare a replacement errors object before construction; pass errors: false when providing your own error-matcher plugin through contractConfig.plugins. Deployed clients scope automatic matching to their contract ID. Clients constructed without an ID match errors from the root invocation only. No additional mutable error-loader API is introduced.\n\nUse client.events.<declaredName>.fromEvent(event) for typed fields while retaining ledger, transaction and raw-XDR metadata. toTopicFilter and toEventFilter accept indexed fields only. Missing declarations do not mean the contract emits no events. Registry bindings records original names and collision-safe properties.\n\nA generated spec is a snapshot. Regenerate after an ABI change; loading a different spec into this typed class invalidates its type guarantees. Network resolution records the exact Wasm hash and separate RPC ledger observations, not an atomic network snapshot. Generation never submits transactions.\n\nRegeneration requires --force to replace generated bindings. Existing package scaffold and handwritten files are preserved. Review dependency upgrades in your manifest separately.\n`;
  if (options.output !== "package") {
    return {
      "README.bindings.md": guide +
        "\nConfigure @colibri/core (^1.1.0) and stellar-sdk (^17.0.1) in your Deno import map for the JSR preset. For the npm preset, install @colibri/core as an alias of @jsr/colibri__core using the JSR npm registry, and @stellar/stellar-sdk.\n",
    };
  }
  const name = options.packageName;
  if (
    !name || !/^(?:@[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*$/.test(name) ||
    (options.target !== "npm" && !name.startsWith("@"))
  ) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "Supply a valid package name (JSR requires @scope/name)",
    );
  }
  const common = {
    "mod.ts":
      '/** Generated client exports. Add handwritten exports here. @module */\nexport * from "./generated/bindings.ts";\n',
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
          "@stellar/stellar-sdk": "^17.0.1",
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
      "README.md": guide +
        "\nRun npm install and npm run build. The package emits ESM JavaScript and declarations into dist. The local .npmrc routes @jsr dependencies to JSR's npm registry; retain that registry configuration in consuming projects and CI. Core is a shared dependency, not copied into these bindings. Review the package name, version and license before publishing.\n",
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
        "stellar-sdk": "npm:@stellar/stellar-sdk@^17.0.1",
      },
      tasks: { check: "deno check mod.ts", fmt: "deno fmt" },
      publish: {
        include: ["mod.ts", "generated/**/*.ts", "README.md", "deno.json"],
      },
    }),
    "README.md": guide +
      "\nRun deno task check. The package exports TypeScript for JSR. Review the package name, version and license before publishing.\n",
  };
}
