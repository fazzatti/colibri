/** Historical diagnostic only: leaf URLs are not supported consumer entrypoints. */
import { resolve } from "node:path";
import { createHash } from "node:crypto";
// @deno-types="npm:@types/pako@2.0.4"
import { gzip } from "npm:pako@2.1.0";
import { command, writeJson } from "../consumers/environment.ts";

if (Deno.version.deno !== "2.9.6") {
  throw new Error("Reproduction requires Deno 2.9.6");
}
const output = resolve(
  Deno.args[0] ??
    await Deno.makeTempDir({ prefix: "colibri-published-probes-" }),
);
await Deno.mkdir(output, { recursive: true });
const fixture = resolve(import.meta.dirname!, "published");
await Deno.copyFile(
  resolve(fixture, "deno.json"),
  resolve(output, "deno.json"),
);
await Deno.copyFile(
  resolve(fixture, "dependencies.lock"),
  resolve(output, "deno.lock"),
);
const probes = JSON.parse(
  await Deno.readTextFile(resolve(fixture, "probes.json")),
) as Record<string, string>;
const expected = JSON.parse(
  await Deno.readTextFile(resolve(fixture, "expected.json")),
);
const results: Record<string, unknown> = {};
for (const [name, probe] of Object.entries(probes)) {
  await Deno.writeTextFile(resolve(output, `${name}.ts`), probe);
  await command(Deno.execPath(), [
    "bundle",
    "--config",
    "deno.json",
    "--frozen-lockfile",
    "--platform",
    "browser",
    "--minify",
    "--output",
    `${name}.js`,
    `${name}.ts`,
  ], output);
  const bytes = await Deno.readFile(resolve(output, `${name}.js`));
  const actual = {
    raw: bytes.length,
    gzip: gzip(bytes, { level: 9 }).length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  results[name] = actual;
  if (JSON.stringify(actual) !== JSON.stringify(expected[name])) {
    throw new Error(
      `Historical bundle changed: ${name}: ${JSON.stringify(actual)}`,
    );
  }
}
await writeJson(resolve(output, "measurements.json"), results);
console.log(`All five published probes reproduced exactly: ${output}`);
