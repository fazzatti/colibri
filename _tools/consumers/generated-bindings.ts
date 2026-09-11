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
const spec = new Spec([
  xdr.ScSpecEntry.scSpecEntryUdtStructV0(new xdr.ScSpecUdtStructV0({
    name: "Config", lib: "", doc: "", fields: [
      new xdr.ScSpecUdtStructFieldV0({ name: "count", doc: "", type: xdr.ScSpecTypeDef.scSpecTypeU32() }),
      new xdr.ScSpecUdtStructFieldV0({ name: "role", doc: "", type: xdr.ScSpecTypeDef.scSpecTypeSymbol() }),
    ],
  })),
  xdr.ScSpecEntry.scSpecEntryUdtUnionV0(new xdr.ScSpecUdtUnionV0({
    name: "RbacStorage", lib: "", doc: "", cases: [
      xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseVoidV0(new xdr.ScSpecUdtUnionCaseVoidV0({ name: "ExistingRoles", doc: "" })),
      xdr.ScSpecUdtUnionCaseV0.scSpecUdtUnionCaseTupleV0(new xdr.ScSpecUdtUnionCaseTupleV0({ name: "RoleIndexToAccount", doc: "", type: [xdr.ScSpecTypeDef.scSpecTypeSymbol(), xdr.ScSpecTypeDef.scSpecTypeU32()] })),
    ],
  })),
  xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ name: "ping", doc: "Ping", inputs: [], outputs: [] })),
  xdr.ScSpecEntry.scSpecEntryFunctionV0(new xdr.ScSpecFunctionV0({ name: "echo", doc: "", inputs: [new xdr.ScSpecFunctionInputV0({ name: "config", doc: "", type: xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: "Config" })) })], outputs: [xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: "Config" }))] })),
  xdr.ScSpecEntry.scSpecEntryUdtErrorEnumV0(new xdr.ScSpecUdtErrorEnumV0({ name: "PingError", lib: "", doc: "", cases: [new xdr.ScSpecUdtErrorEnumCaseV0({ name: "Unavailable", value: 1, doc: "Try again later." })] })),
]);
const plan = generateBindings(spec, { className: "PingClient", output: "package", target: "npm", packageName: "@example/generated-ping" });
assert(!plan.files["generated/types.ts"].includes("export enum PingError"));
for (const [path, content] of Object.entries({...plan.files, ...plan.scaffold})) {
  await mkdir(dirname("generated-package/" + path), { recursive: true });
  await writeFile("generated-package/" + path, content);
}
const manifest = JSON.parse(await readFile("generated-package/package.json", "utf8"));
assert.deepEqual(Object.keys(manifest.dependencies), ["@colibri/core"]);
assert.equal(manifest.dependencies["@colibri/core"], "npm:@jsr/colibri__core@^1.1.0");
// Test the candidate Core build while preserving the generated dependency shape.
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
    `typescript@${Deno.env.get("TYPESCRIPT_VERSION") ?? "5.9.3"}`,
  ], output);
  await command("npx", ["--no-install", "tsc", "--version"], output);
  await command("npm", ["run", "build"], output);
  await Deno.writeTextFile(
    resolve(output, "smoke.mjs"),
    `
import { PingClient, PingClientSpec, PingClientErrors, ContractMethods, Config, RbacStorage } from "./dist/mod.js";
import { NetworkConfig, LocalSigner, SorobanType } from "@example/generated-ping/colibri";
import { NetworkConfig as RootNetworkConfig } from "@example/generated-ping";
import { Contract, NetworkConfig as CoreNetworkConfig, LocalSigner as CoreLocalSigner, extractContractErrorMapFromSpec, SorobanValueError } from "@colibri/core";
import { strict as assert } from "node:assert";
assert.equal(NetworkConfig, CoreNetworkConfig);
assert.equal(NetworkConfig, RootNetworkConfig);
assert.equal(LocalSigner, CoreLocalSigner);
const client = new PingClient({ networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" } });
assert(client instanceof Contract);
assert.equal(PingClientSpec.getFunc("ping").name.toString(), "ping");
assert.equal(ContractMethods.Ping, "ping");
assert.deepEqual(PingClientErrors[1], { name: "Unavailable", category: "PingError", message: "Unavailable", details: "Try again later." });
assert.deepEqual(extractContractErrorMapFromSpec(PingClientSpec), PingClientErrors);
assert.equal(client.events.list().length, 0);
const config = Config.from({ count: SorobanType.U32.from(7), role: SorobanType.Symbol.from("ADMIN") });
assert.deepEqual(Config.fromScVal(config.toScVal()).value, { count: 7, role: "ADMIN" });
assert.deepEqual(RbacStorage.ExistingRoles().value, { tag: "ExistingRoles" });
assert.deepEqual(RbacStorage.RoleIndexToAccount(SorobanType.Symbol.from("ADMIN"), 7).value, { tag: "RoleIndexToAccount", values: ["ADMIN", 7] });
assert.throws(() => Config.from({ count: -1, role: "ADMIN" }), SorobanValueError);
const read = Contract.prototype.read, invoke = Contract.prototype.invoke;
try {
  Contract.prototype.read = async ({ method }) => method === "ping" ? null : config.value;
  const { read: readEcho } = client.echo;
  assert.deepEqual(await readEcho({ config }), config.value);
  assert.equal(await client.ping.read(), null);
  const transactionConfig = { source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", fee: "100", timeout: 10, signers: [] };
  let submitted;
  Contract.prototype.invoke = async (args) => {
    submitted = args;
    return { hash: "abc", ledger: 1, createdAt: 2, returnValue: config.toScVal(), response: {} };
  };
  const result = await client.echo.invoke({ methodArgs: { config }, config: transactionConfig });
  assert.equal(submitted.method, "echo");
  assert.equal(submitted.config, transactionConfig);
  assert.deepEqual(result.value, config.value);
  assert.equal(result.hash, "abc");
} finally {
  Contract.prototype.read = read;
  Contract.prototype.invoke = invoke;
}
console.log("Generated npm package: ESM imports, declarations, custom factories, native SDK codec and Core identity passed.");
`,
  );
  await command("node", ["smoke.mjs"], output);
  await Deno.writeTextFile(
    resolve(output, "consumer.ts"),
    `
import { PingClient, ContractMethods, PingClientErrors, Config, RbacStorage, type PingClientInvocation, type PingClientInvocationResult } from "./dist/mod.js";
import { SorobanType, LocalSigner, type Signer, type TransactionConfig } from "@example/generated-ping/colibri";
import type { ContractErrorMap, KnownContractErrorMap } from "@colibri/core";
import { Keypair } from "@stellar/stellar-sdk";
declare const client: PingClient;
const native = Keypair.random();
const signers: Signer[] = [LocalSigner.fromKeypair(native), LocalSigner.generateRandom()];
const config: TransactionConfig = { source: native.publicKey() as TransactionConfig["source"], fee: "100", timeout: 30, signers };
const nativeInvocation = client.ping.invoke({ config });
void nativeInvocation;
const literal: Promise<null> = client.read({ method: "ping" });
const member: Promise<null> = client.read({ method: ContractMethods.Ping });
const category: "PingError" = PingClientErrors[1].category;
const manual: ContractErrorMap = { 7: { message: "Existing manual map" } };
const previous: KnownContractErrorMap = manual;
const current: ContractErrorMap = previous;
const wrapped = Config.from({ count: SorobanType.U32.from(7), role: "ADMIN" });
const decoded: Config = wrapped.value;
const echo: Promise<Config> = client.read({ method: "echo", methodArgs: { config: wrapped } });
declare const options: PingClientInvocation;
const direct: Promise<Config> = client.echo.read({ config: wrapped });
const submitted: Promise<PingClientInvocationResult<Config>> = client.echo.invoke({ methodArgs: { config: wrapped }, ...options });
const ping: Promise<PingClientInvocationResult<null>> = client.ping.invoke(options);
// @ts-expect-error Required method arguments.
client.echo.read();
// @ts-expect-error Invoke requires transaction configuration.
client.echo.invoke({ methodArgs: { config: wrapped } });
// @ts-expect-error Method arguments remain required.
client.echo.invoke(options);
// @ts-expect-error The previous split-argument form is unsupported.
client.echo.invoke({ config: wrapped }, options);
// @ts-expect-error No-argument invokes take one object.
client.ping.invoke({}, options);
const key: RbacStorage = RbacStorage.RoleIndexToAccount(SorobanType.Symbol.from("ADMIN"), 7).value;
// @ts-expect-error Struct fields retain their native or wrapped scalar type.
Config.from({ count: "wrong", role: "ADMIN" });
// @ts-expect-error Union constructors require the declared tuple fields.
RbacStorage.RoleIndexToAccount("ADMIN");
// @ts-expect-error Invalid method, including with the enum API present.
client.read({ method: "absent" });
// @ts-expect-error Ping has no arguments.
client.read({ method: ContractMethods.Ping, methodArgs: { value: 1 } });
void [literal, member, category, manual, current, decoded, echo, direct, submitted, ping, key];
`,
  );
  await Deno.writeTextFile(
    resolve(output, "tsconfig.consumer.json"),
    JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        module: "nodenext",
        target: "ES2023",
      },
      files: ["consumer.ts"],
    }),
  );
  await command("npx", [
    "--no-install",
    "tsc",
    "--project",
    "tsconfig.consumer.json",
  ], output);
  await command("npm", ["pack", "--ignore-scripts"], output);
}
