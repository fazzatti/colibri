/** Exercise the actual npm scaffold with a pre-publication Core tarball. */
import { resolve } from "node:path";
import { command } from "./environment.ts";

export async function checkGeneratedBindings(
  consumer: string,
  coreArchive: string,
): Promise<void> {
  const script = `
import { generateBindings } from "@colibri/contract-bindings";
import { Spec } from "@stellar/stellar-sdk/contract";
import { xdr } from "@stellar/stellar-sdk";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { strict as assert } from "node:assert";
const spec = new Spec([xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ name: "ping", doc: "Ping", inputs: [], outputs: [] }))]);
const plan = generateBindings(spec, { className: "PingClient", output: "package", target: "npm", packageName: "@example/generated-ping" });
for (const [path, content] of Object.entries({...plan.files, ...plan.scaffold})) {
  await mkdir(dirname("generated-package/" + path), { recursive: true });
  await writeFile("generated-package/" + path, content);
}
const manifest = JSON.parse(await readFile("generated-package/package.json", "utf8"));
assert.equal(manifest.dependencies["@colibri/core"], "npm:@jsr/colibri__core@^1.1.0");
// Core 1.1 has not been published yet. Substitute only its equivalent test artifact.
manifest.dependencies["@colibri/core"] = ${
    JSON.stringify(`file:${coreArchive}`)
  };
await writeFile("generated-package/package.json", JSON.stringify(manifest, null, 2));
`;
  await Deno.writeTextFile(resolve(consumer, "generate-bindings.mjs"), script);
  await command("node", ["generate-bindings.mjs"], consumer);
  const output = resolve(consumer, "generated-package");
  await command("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ], output);
  await command("npm", ["run", "build"], output);
  await Deno.writeTextFile(
    resolve(output, "smoke.mjs"),
    `
import { PingClient, PingClientSpec } from "./dist/mod.js";
import { Contract, NetworkConfig } from "@colibri/core";
import { xdr } from "@stellar/stellar-sdk";
import { strict as assert } from "node:assert";
const client = new PingClient({ networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" } });
assert(client instanceof Contract);
assert.equal(PingClientSpec.funcResToNative("ping", xdr.ScVal.scvVoid()), null);
assert.equal(client.events.list().length, 0);
console.log("Generated npm package: ESM imports, declarations, native SDK codec and Core identity passed.");
`,
  );
  await command("node", ["smoke.mjs"], output);
  await command("npm", ["pack", "--ignore-scripts"], output);
}
