/** Execute installed artifacts with the selected real Node/TypeScript/browser runtime. */
import { checkGeneratedBindings } from "./generated-bindings.ts";
import { resolve } from "node:path";
import { command, playwrightVersion, writeJson } from "./environment.ts";

export async function runArtifacts(
  artifacts: string,
  browsers = false,
): Promise<void> {
  const manifest = JSON.parse(
    await Deno.readTextFile(resolve(artifacts, "manifest.json")),
  );
  const consumer = await Deno.makeTempDir({
    prefix: "colibri-installed-consumer-",
  });
  try {
    const typescript = Deno.env.get("TYPESCRIPT_VERSION") ?? "5.9.3";
    await writeJson(resolve(consumer, "package.json"), {
      private: true,
      type: "module",
      dependencies: {
        "@jsr/fifo__convee": manifest.convee.split("@").at(-1),
      },
    });
    await Deno.writeTextFile(
      resolve(consumer, ".npmrc"),
      "@jsr:registry=https://npm.jsr.io\n",
    );
    await command("npm", [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...manifest.packages.map((pkg: { archive: string }) =>
        resolve(artifacts, pkg.archive)
      ),
      `@stellar/stellar-sdk@${manifest.sdk}`,
      `typescript@${typescript}`,
      "esbuild@0.28.2",
      ...(browsers ? [`playwright@${playwrightVersion}`] : []),
    ], consumer);
    await command("node", ["--version"], consumer);
    await command("npx", ["--no-install", "tsc", "--version"], consumer);
    await command("npm", [
      "ls",
      "@stellar/stellar-sdk",
      "@colibri/core",
      "@jsr/fifo__convee",
    ], consumer);
    for (const file of ["smoke.ts", "extensions.ts", "keypair-signer.ts"]) {
      const fixture = await Deno.readTextFile(
        resolve(artifacts, "fixtures", file),
      );
      await Deno.writeTextFile(
        resolve(consumer, file),
        fixture.replaceAll('"stellar-sdk', '"@stellar/stellar-sdk').replaceAll(
          '"convee"',
          '"@jsr/fifo__convee"',
        ),
      );
    }
    await Deno.writeTextFile(
      resolve(consumer, "bindings-smoke.ts"),
      `
import { generateBindings } from "@colibri/contract-bindings";
import { Spec } from "@stellar/stellar-sdk/contract";
import { xdr } from "@stellar/stellar-sdk";
import { SorobanSymbol, SorobanString, SorobanU32, SorobanVec, SorobanBytesN, SorobanValueError } from "@colibri/core/values";
import { SorobanSymbol as RootSymbol, type SorobanVecInput, type SorobanStringInput } from "@colibri/core";
if (RootSymbol !== SorobanSymbol) throw new Error("Value constructor identity changed");
const value = new SorobanSymbol("ADMIN");
if (SorobanSymbol.type.fromXdr(value.toXdr("base64")).value !== "ADMIN") throw new Error("Value encoding changed");
const text: SorobanVecInput<SorobanStringInput, string> = new SorobanVec([new SorobanString("hello")], SorobanString.type);
const fixed = new SorobanBytesN(new Uint8Array(32), 32);
const length: 32 = fixed.value.length;
if (length !== 32 || !text) throw new Error("Value type mismatch");
let rejected = false;
try { new SorobanU32(-1); } catch (error) { rejected = error instanceof SorobanValueError && error.code === "SV_001"; }
if (!rejected) throw new Error("Value validation missing");
const spec = new Spec([xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ name: "ping", doc: "Ping", inputs: [], outputs: [] }))]);
const plan = generateBindings(spec, {className: "PingClient"});
if (!plan.files["index.ts"].includes("class PingClient extends Contract")) throw new Error("Portable bindings rendering failed");
`,
    );
    await command("npx", [
      "--no-install",
      "tsc",
      "smoke.ts",
      "extensions.ts",
      "bindings-smoke.ts",
      "keypair-signer.ts",
      "--outDir",
      "out",
      "--module",
      "nodenext",
      "--target",
      "ES2023",
      "--strict",
      "--skipLibCheck",
    ], consumer);
    await command("node", ["out/smoke.js"], consumer);
    await command("node", ["out/extensions.js"], consumer);
    await command("node", ["out/bindings-smoke.js"], consumer);
    await command("node", ["out/keypair-signer.js"], consumer);
    if (browsers) {
      await Deno.writeTextFile(
        resolve(consumer, "browser-entry.ts"),
        'import "./smoke.ts";\nimport "./extensions.ts";\nimport "./bindings-smoke.ts";\nimport "./keypair-signer.ts";\n(globalThis as unknown as { colibriPassed: boolean }).colibriPassed = true;\n',
      );
      await command("npx", [
        "--no-install",
        "esbuild",
        "browser-entry.ts",
        "--bundle",
        "--platform=browser",
        "--format=esm",
        "--outfile=browser.js",
      ], consumer);
      await command("npx", [
        "--no-install",
        "playwright",
        "install",
        ...(Deno.build.os === "linux" ? ["--with-deps"] : []),
        "chromium",
        "firefox",
        "webkit",
      ], consumer);
      for (const file of ["browser.mjs", "browser-fixture.mjs"]) {
        await Deno.copyFile(
          resolve(import.meta.dirname!, file),
          resolve(consumer, file),
        );
      }
      await command("node", ["browser.mjs"], consumer);
    }
    if (!browsers) {
      const core = manifest.packages.find((pkg: { name: string }) =>
        pkg.name === "@colibri/core"
      );
      await checkGeneratedBindings(consumer, resolve(artifacts, core.archive));
    }
    console.log(
      `Installed artifact consumer passed with SDK ${manifest.sdk} / TypeScript ${typescript}${
        browsers ? " / Chromium, Firefox, WebKit" : ""
      }.`,
    );
  } finally {
    await Deno.remove(consumer, { recursive: true });
  }
}

if (import.meta.main) {
  await runArtifacts(
    resolve(Deno.args[0] ?? "_artifacts/consumers"),
    Deno.args.includes("--browsers"),
  );
}
