/** Build production Deno and Rollup consumers, inspect retained code, execute browsers. */
import { resolve } from "node:path";
import {
  checkResolvedSdk,
  command,
  prepareSource,
  root,
  writeJson,
} from "../consumers/environment.ts";
import { entries } from "./fixtures.ts";
import { checkMeasurement, measure } from "./metrics.ts";

const destination = resolve(Deno.args[0] ?? "_artifacts/bundles");
const artifacts = resolve(Deno.args[1] ?? "_artifacts/consumers");
if (Deno.version.deno !== "2.9.6") {
  throw new Error("Bundle baselines require Deno 2.9.6.");
}
const manifest = JSON.parse(
  await Deno.readTextFile(resolve(artifacts, "manifest.json")),
);
if (manifest.sdk !== "17.0.1") {
  throw new Error("Bundle baselines require SDK 17.0.1 artifacts.");
}
await Deno.mkdir(destination, { recursive: true });
const source = resolve(destination, "source");
await prepareSource(source, "17.0.1");
await Deno.copyFile(
  resolve(root, "_tools/bundles/dependencies.lock"),
  resolve(source, "deno.lock"),
);
const denoOutput = resolve(destination, "deno");
await Deno.mkdir(denoOutput, { recursive: true });
for (const [name, entry] of Object.entries(entries)) {
  await Deno.writeTextFile(resolve(source, `${name}.ts`), entry);
}
// Use the reviewed dependency fixture for every measured build. Persist it with
// the report so transitive resolutions can be audited and replayed.
await command(Deno.execPath(), [
  "cache",
  "--frozen-lockfile",
  "--config",
  "deno.json",
  ...Object.keys(entries).map((name) => `${name}.ts`),
], source);
await checkResolvedSdk(source, "17.0.1");
const deno: Record<string, ReturnType<typeof measure>> = {};
for (const name of Object.keys(entries)) {
  const output = resolve(denoOutput, `${name}.js`);
  const process = await new Deno.Command(Deno.execPath(), {
    cwd: source,
    args: [
      "bundle",
      "--config",
      "deno.json",
      "--frozen-lockfile",
      "--platform",
      "browser",
      "--minify",
      "--sourcemap=external",
      "--output",
      output,
      `${name}.ts`,
    ],
  }).output();
  await Deno.writeFile(resolve(denoOutput, `${name}.log`), process.stderr);
  if (!process.success) {
    throw new Error(new TextDecoder().decode(process.stderr));
  }
  deno[name] = measure(
    await Deno.readFile(output),
    await Deno.readTextFile(`${output}.map`),
  );
}
await writeJson(resolve(destination, "deno.json"), {
  runtime: Deno.version,
  sdk: manifest.sdk,
  compression: "pako@2.1.0 gzip level 9",
  bundles: deno,
});
await Deno.copyFile(
  resolve(source, "deno.lock"),
  resolve(destination, "deno.lock"),
);
for (const [name, data] of Object.entries(deno)) checkMeasurement(name, data);

const consumer = resolve(destination, "npm");
await Deno.mkdir(consumer, { recursive: true });
await writeJson(resolve(consumer, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    ...Object.fromEntries(
      manifest.packages.filter((pkg: { name: string }) =>
        ["@colibri/core", "@colibri/identicon"].includes(pkg.name)
      ).map((
        pkg: { name: string; archive: string },
      ) => [pkg.name, `file:${resolve(artifacts, pkg.archive)}`]),
    ),
    "@stellar/stellar-sdk": "17.0.1",
    rollup: "4.50.1",
    pako: "2.1.0",
    "@rollup/plugin-node-resolve": "16.0.1",
    "@rollup/plugin-commonjs": "28.0.6",
    "@rollup/plugin-terser": "0.4.4",
    playwright: "1.61.0",
  },
});
await Deno.writeTextFile(
  resolve(consumer, ".npmrc"),
  "@jsr:registry=https://npm.jsr.io\n",
);
await command(
  "npm",
  ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
  consumer,
);
await command("npm", ["ls", "@stellar/stellar-sdk", "@colibri/core"], consumer);
for (const [name, entry] of Object.entries(entries)) {
  await Deno.writeTextFile(
    resolve(consumer, `${name}.js`),
    entry.replaceAll('"stellar-sdk', '"@stellar/stellar-sdk'),
  );
}
await writeJson(resolve(consumer, "entries.json"), Object.keys(entries));
await Deno.copyFile(
  resolve(root, "_tools/bundles/rollup.mjs"),
  resolve(consumer, "rollup.mjs"),
);
await command("node", ["rollup.mjs"], consumer);
const rollup = JSON.parse(
  await Deno.readTextFile(resolve(destination, "rollup.json")),
);
for (const name of Object.keys(entries)) {
  checkMeasurement(name, rollup.bundles[name]);
}
await Deno.copyFile(
  resolve(root, "_tools/bundles/browser.mjs"),
  resolve(consumer, "browser.mjs"),
);
await command("npx", [
  "--no-install",
  "playwright",
  "install",
  ...(Deno.build.os === "linux" ? ["--with-deps"] : []),
  "chromium",
  "firefox",
  "webkit",
], consumer);
await command("node", ["browser.mjs"], consumer);
console.log(
  `Production bundles and browser execution passed. Evidence: ${destination}`,
);
