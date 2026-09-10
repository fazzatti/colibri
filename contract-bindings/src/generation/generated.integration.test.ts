import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { extractContractSpec } from "@colibri/core";
import { loadBindingSource } from "@/source/load.ts";
import { generateBindings } from "@/generation/generate.ts";
import { writeBindings } from "@/output/write.ts";
import {
  func,
  struct,
  udt,
  valueSpec,
} from "colibri-internal/tests/soroban-values-fixtures.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";
import { fileURLToPath } from "node:url";

const rootConfig = fileURLToPath(
  new URL("../../../deno.json", import.meta.url),
);
async function deno(args: string[]): Promise<void> {
  const result = await new Deno.Command(Deno.execPath(), {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(
    result.code,
    0,
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
}
describe("generated consumer boundary", () => {
  it("type-checks real token, error and full native type fixtures", async () => {
    const directory = await Deno.makeTempDir();
    try {
      for (
        const [index, name] of [
          "fungible_token_contract",
          "types_harness",
          "errors_contract",
        ].entries()
      ) {
        const spec = extractContractSpec(
          await Deno.readFile(
            `_internal/tests/compiled-contracts/${name}.wasm`,
          ),
        );
        await writeBindings(
          generateBindings(spec, { className: `Fixture${index}` }),
          { directory: `${directory}/${name}` },
        );
      }
      await deno([
        "check",
        "--config",
        rootConfig,
        ...["fungible_token_contract", "types_harness", "errors_contract"].map(
          (name) => `${directory}/${name}/index.ts`,
        ),
      ]);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("generates usable custom factories and accepts mixed raw/wrapped values", async () => {
    const directory = await Deno.makeTempDir();
    try {
      await writeBindings(
        generateBindings(
          new Spec([
            ...valueSpec().entries,
            func("config", { config: udt("Config") }, [udt("Config")]),
            struct("RbacStorageArgs", {
              value: xdr.ScSpecTypeDef.scSpecTypeU32(),
            }),
          ]),
          { className: "ValuesClient" },
        ),
        { directory },
      );
      await Deno.writeTextFile(
        `${directory}/consumer.ts`,
        `
import { ValuesClient, RbacStorage, Config, type Config as ConfigNative, type ConfigArgs, type ConfigInput, type RbacStorageValueArgs, type RbacStorageArgs } from "./index.ts";
import { SorobanType, SorobanU32, SorobanString, SorobanVec, NetworkConfig, encodeSorobanArguments, buildContractDataLedgerKey, type ContractId } from "@colibri/core";
import { assertEquals } from "@std/assert";
const key = RbacStorage.RoleIndexToAccount(SorobanType.Symbol.from("ADMIN"), SorobanType.U32.from(7));
assertEquals(key.value, { tag: "RoleIndexToAccount", values: ["ADMIN", 7] });
assertEquals(RbacStorage.ExistingRoles().value, { tag: "ExistingRoles" });
const keyArgs: RbacStorageValueArgs = key;
const declaredType: RbacStorageArgs = { value: 7 };
const configArgs: ConfigArgs = { role: "ADMIN", count: SorobanType.U32.from(7), key: keyArgs };
const config = Config.from(configArgs);
const plain: ConfigNative = config.value;
const methodInput: ConfigInput = { config };
const rawArgs: ConfigArgs = plain;
assertEquals(Config.from(rawArgs).value.count, declaredType.value);
const client = new ValuesClient({ errors: false, networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" } });
const raw = encodeSorobanArguments(client.getSpec(), "echo", { config: plain });
const wrapped = encodeSorobanArguments(client.getSpec(), "echo", { config });
assertEquals(raw.map(value => value.toXdr("base64")), wrapped.map(value => value.toXdr("base64")));
assertEquals(Config.fromXdr(config.toXdr("base64")).value, plain);
const contractId = client.getContractId() as ContractId;
assertEquals(buildContractDataLedgerKey({ contractId, key }).toXdr("base64"), buildContractDataLedgerKey({ contractId, key: key.toScVal() }).toXdr("base64"));
function checkTypes() {
  const custom: Promise<ConfigNative> = client.read({ method: "config", methodArgs: methodInput });
  const directCustom: Promise<ConfigNative> = client.config.read(methodInput);
  // @ts-expect-error Factory arguments are a custom value, not the method's argument object.
  const wrong: ConfigInput = configArgs;
  void [custom, directCustom, wrong];
  const text: Promise<string[]> = client.read({ method: "texts", methodArgs: { values: new SorobanVec([new SorobanString("hello")], SorobanString.type) } });
  const old: Promise<ConfigNative> = client.read({ method: "echo", methodArgs: { config: plain } });
  const added: Promise<ConfigNative> = client.read({ method: "echo", methodArgs: { config } });
  const directAdded: Promise<ConfigNative> = client.echo.read({ config });
  const mixed: Promise<ConfigNative> = client.read({ method: "echo", methodArgs: { config: { role: SorobanType.Symbol.from("ADMIN"), count: 7, key } } });
  // @ts-expect-error A String helper is not a Symbol helper.
  RbacStorage.RoleIndexToAccount(new SorobanString("ADMIN"), 7);
  // @ts-expect-error Fixed variant payload arity.
  RbacStorage.RoleIndexToAccount("ADMIN");
  // @ts-expect-error Unknown variant.
  RbacStorage.Missing();
  // @ts-expect-error Outputs remain plain values.
  const invalid: { count: SorobanU32 } = plain;
  void [old, added, directAdded, mixed, invalid, text];
}
void checkTypes;
`,
      );
      await deno(["check", "--config", rootConfig, `${directory}/consumer.ts`]);
      await deno(["run", "--config", rootConfig, `${directory}/consumer.ts`]);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("enforces method/input/output/event correlation and delegates to Core", async () => {
    const directory = await Deno.makeTempDir();
    try {
      await writeBindings(
        generateBindings(
          new Spec([
            ...bindingSpec().entries,
            xdr.ScSpecEntry.scSpecEntryFunctionV0(
              new xdr.ScSpecFunctionV0({
                name: "__proto__",
                doc: "An ordinary ABI method, not an object prototype.",
                inputs: [],
                outputs: [],
              }),
            ),
          ]),
          { className: "Token" },
        ),
        { directory },
      );
      await Deno.writeTextFile(
        `${directory}/consumer.ts`,
        `
import { Token, ContractMethods, type TokenInvocationResult } from "./index.ts";
import { Contract, ColibriError, NetworkConfig, type InvokeContractOutput, type ContractDataLedgerEntry, type ContractErrorMap, type KnownContractErrorMap, Event, EventType } from "@colibri/core";
import { xdr, nativeToScVal } from "stellar-sdk";
import { assertEquals, assertRejects } from "@std/assert";
assertEquals(Object.hasOwn(ContractMethods, "Proto"), true);
assertEquals(ContractMethods.Proto, "__proto__");
const token = new Token({ networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" } });
function types() {
  const previous: KnownContractErrorMap = { 1: { message: "Unauthorized" } };
  const current: ContractErrorMap = previous;
  const compatible: KnownContractErrorMap = current;
  const config = { networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as const } };
  new Token({ ...config, errors: current });
  new Token({ ...config, errors: compatible });
  const base: Contract = token;
  // @ts-expect-error Decoding is an internal protected subclass helper.
  token.decodeInvocationResult;
  // @ts-expect-error The base Contract does not expose the helper publicly either.
  base.decodeInvocationResult;
  const ledger: Promise<ContractDataLedgerEntry> = token.getLedgerEntry({ key: xdr.ScVal.scvSymbol("counter"), durability: "temporary" });
  // @ts-expect-error The contract identity is already bound.
  token.getLedgerEntry({ key: xdr.ScVal.scvSymbol("counter"), contractId: "C..." });
  // @ts-expect-error Instance storage is not a contract-data durability.
  token.getLedgerEntry({ key: xdr.ScVal.scvSymbol("counter"), durability: "instance" });
  void ledger;
  const balance: Promise<bigint> = token.read({ method: "balance", methodArgs: { owner: "alice" } });
  const ping: Promise<null> = token.read({ method: ContractMethods.Ping });
  const enumBalance: Promise<bigint> = token.read({ method: ContractMethods.Balance, methodArgs: { owner: "alice" } });
  // @ts-expect-error Enum values retain correlated argument checking.
  token.read({ method: ContractMethods.Balance, methodArgs: { owner: 1 } });
  void enumBalance;
  // @ts-expect-error Invalid ABI method.
  token.read({ method: "absent" });
  // @ts-expect-error Required method arguments.
  token.read({ method: "balance" });
  // @ts-expect-error Incorrect input value.
  token.read({ method: "balance", methodArgs: { owner: 1 } });
  // @ts-expect-error Correlated method arguments.
  token.read({ method: "ping", methodArgs: { owner: "alice" } });
  // @ts-expect-error Incorrect output assignment.
  const bad: Promise<string> = balance;
  // @ts-expect-error Only indexed fields may be filtered.
  token.events.Transfer.toTopicFilter({ amount: 1n });
  token.events.Transfer.toTopicFilter({ owner: "alice" });
  void [base, balance, ping, bad];
}
void types;
const read = Contract.prototype.read, invoke = Contract.prototype.invoke;
try {
  Contract.prototype.read = async args => args.method === "ping" ? null : 42n;
  assertEquals(await token.read({ method: ContractMethods.Balance, methodArgs: { owner: "alice" } }), 42n);
  assertEquals(await token.read({ method: "ping" }), null);
  const raw = { hash: "abc", ledger: 1, createdAt: 2, returnValue: nativeToScVal(42n, {type:"i128"}), response: {} } as InvokeContractOutput;
  Contract.prototype.invoke = async () => raw;
  const result: TokenInvocationResult<bigint> = await token.invoke({ method: "balance", methodArgs: { owner: "alice" }, config: { source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", fee: "100", timeout: 10, signers: [] } });
  assertEquals(result.value, 42n);
  assertEquals(result.returnValue, raw.returnValue);
  assertEquals(result.hash, "abc");
  Contract.prototype.invoke = async () => ({ ...raw, returnValue: xdr.ScVal.scvString("wrong ABI") });
  const decodingError = await assertRejects(() => token.invoke({ method: "balance", methodArgs: { owner: "alice" }, config: { source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", fee: "100", timeout: 10, signers: [] } }), ColibriError);
  assertEquals(decodingError.code, "CONTR_021");
  assertEquals((decodingError.meta?.data as { result: {hash:string} }).result.hash, "abc");
  Contract.prototype.invoke = async () => ({ ...raw, returnValue: undefined });
  assertEquals((await token.invoke({ method: "ping", config: {source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", fee:"100",timeout:10,signers:[]} })).value, undefined);
  const pipelineFailure = new Error("submission failed");
  Contract.prototype.invoke = () => Promise.reject(pipelineFailure);
  const invocationError = await assertRejects(() => token.invoke({ method: "ping", config: {source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", fee:"100",timeout:10,signers:[]} }));
  assertEquals(invocationError === pipelineFailure, true);
  const event = new Event({ id: "0000000042949672960-0000000001", type: EventType.Contract, ledger: 10, ledgerClosedAt: "2026-01-01T00:00:00Z", transactionIndex: 1, operationIndex: 0, inSuccessfulContractCall: true, txHash: "abc", contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM", topic: [xdr.ScVal.scvSymbol("transfer"), xdr.ScVal.scvSymbol("alice")], value: xdr.ScVal.scvMap([new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol("amount"),val:raw.returnValue!})]) });
  const amount: bigint = token.events.Transfer.fromEvent(event).get("amount");
  assertEquals(amount, 42n);
} finally { Contract.prototype.read = read; Contract.prototype.invoke = invoke; }
`,
      );
      await deno([
        "run",
        "--check",
        "-A",
        "--config",
        rootConfig,
        `${directory}/consumer.ts`,
      ]);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
  it("keeps the reviewable dummy client and guide current, formatted and type-correct", async () => {
    const loaded = await loadBindingSource({
      kind: "wasm",
      wasm: await Deno.readFile(
        "_internal/tests/compiled-contracts/bindings_demo_contract.wasm",
      ),
    });
    const plan = generateBindings(loaded.spec, {
      className: "Demo",
    });
    assertEquals(plan.warnings, []);
    assertEquals(loaded.spec.events().map((event) => event.name.toString()), [
      "CountChanged",
    ]);
    const folder = "_internal/tests/generated-bindings/demo";
    for (
      const [name, content] of Object.entries({
        ...plan.files,
        ...plan.scaffold,
      })
    ) {
      assertEquals(
        await Deno.readTextFile(`${folder}/${name}`),
        content,
        `Review and refresh ${name}`,
      );
    }
    // A workspace map exposes Core as local source, so its existing cross-package
    // private-type-ref diagnostics are expected here. New generated variables
    // still need explicit types that JSR can analyze without inference.
    const docs = await new Deno.Command(Deno.execPath(), {
      args: ["doc", "--lint", `${folder}/index.ts`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const diagnostics = new TextDecoder().decode(docs.stderr);
    const codes = [...diagnostics.matchAll(/error\[([\w-]+)\]/g)].map((match) =>
      match[1]
    );
    assert(
      docs.success ||
        (codes.length > 0 &&
          codes.every((code) => code === "private-type-ref")),
      diagnostics,
    );
    const types = plan.files["types.ts"];
    for (
      const name of [
        "CounterSummary",
        "CounterStatus",
        "CounterSummaryArgs",
        "CounterStatusArgs",
        "GetCountInput",
        "GetCountOutput",
        "EchoSummaryInput",
        "CountChanged",
        "CountChangedTopics",
      ]
    ) {
      assert(
        types.includes(`export type ${name} `) ||
          types.includes(`export enum ${name} `),
        name,
      );
    }
    assert(!/Type\d+_/.test(types));
    assert(!types.includes("CounterSummaryOutput"));
    assert(plan.scaffold["README.md"].includes("```ts"));
    await deno([
      "fmt",
      "--check",
      ...["constants.ts", "types.ts", "index.ts"].map((name) =>
        `${folder}/${name}`
      ),
    ]);
    await deno(["check", "--config", rootConfig, `${folder}/index.ts`]);
  });
});
