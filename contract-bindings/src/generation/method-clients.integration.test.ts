import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Spec } from "@colibri/core";
import { generateBindings } from "@/generation/generate.ts";
import { writeBindings } from "@/output/write.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";
import { func } from "colibri-internal/tests/soroban-values-fixtures.ts";
import { fileURLToPath } from "node:url";

describe("generated method clients", () => {
  it("keeps typed arguments, binding, dispatch, metadata and failures through Core", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const spec = new Spec([
        ...bindingSpec().entries,
        ...[
          "read",
          "readMethod",
          "invoke",
          "events",
          "rpc",
          "getSpec",
          "require",
          "constructor",
          "__proto__",
          "then",
          "grant_role",
        ].map(
          (name) => func(name, {}),
        ),
      ]);
      await writeBindings(generateBindings(spec, { className: "Token" }), {
        directory,
      });
      await Deno.writeTextFile(
        `${directory}/consumer.ts`,
        `
import { Token, type TokenMethod, type TokenInvocation, type TokenInvocationResult } from "./index.ts";
import { Contract, ColibriError, NetworkConfig, SorobanType, type InvokeContractOutput } from "@colibri/core";
import { xdr, nativeToScVal } from "stellar-sdk";
import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const token = new Token({ errors: false, networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId } });
const other = new Token({ errors: false, networkConfig: NetworkConfig.TestNet(), contractConfig: { contractId } });
const options: TokenInvocation = {
  config: { source: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", fee: "100", timeout: 10, signers: [] },
  auth: [],
};
const input = { owner: SorobanType.Symbol.from("alice") };
function types() {
  const helpers: TokenMethod<"balance"> = token.balance;
  const read: Promise<bigint> = helpers.read(input);
  const invoke: Promise<TokenInvocationResult<bigint>> = helpers.invoke({ methodArgs: input, ...options });
  const ping: Promise<null> = token.ping.read();
  const pingInvoke: Promise<TokenInvocationResult<null>> = token.ping.invoke(options);
  // @ts-expect-error Required ABI arguments.
  token.balance.read();
  // @ts-expect-error Incorrect field value.
  token.balance.read({ owner: 7 });
  // @ts-expect-error No other method's input is accepted.
  token.ping.read({ owner: "alice" });
  // @ts-expect-error Invocation settings are required.
  token.balance.invoke({ methodArgs: input });
  // @ts-expect-error The config field is required.
  token.balance.invoke({ ...options, methodArgs: input, config: undefined });
  // @ts-expect-error Required method arguments cannot be omitted.
  token.balance.invoke(options);
  // @ts-expect-error Argument values remain typed inside methodArgs.
  token.balance.invoke({ ...options, methodArgs: { owner: 7 } });
  // @ts-expect-error Method arguments are not flattened into transaction settings.
  token.balance.invoke({ ...options, owner: "alice" });
  // @ts-expect-error Invoke takes a single object, never separate arguments/settings.
  token.balance.invoke(input, options);
  // @ts-expect-error Argument-free methods reject unrelated fields.
  token.ping.invoke({ ...options, methodArgs: { owner: "alice" } });
  // @ts-expect-error Argument-free invokes also take one object.
  token.ping.invoke({}, options);
  // @ts-expect-error The ABI method is fixed by the property.
  token.balance.invoke({ ...options, methodArgs: input, method: "ping" });
  // @ts-expect-error Output retains its ABI type.
  const wrong: Promise<string> = read;
  // @ts-expect-error No undeclared method.
  token.missing.read();
  void [read, invoke, ping, pingInvoke, wrong];
}
void types;
const read = Contract.prototype.read, invoke = Contract.prototype.invoke;
const calls: { client: Contract; method: string; methodArgs?: object }[] = [];
try {
  Contract.prototype.read = async function(args) {
    calls.push({ client: this, ...args });
    return args.method === "balance" ? 42n : null;
  };
  const { read: detachedRead, invoke: detachedInvoke } = token.balance;
  assertEquals(await detachedRead(input), 42n);
  assertEquals(calls[0], { client: token, method: "balance", methodArgs: input });
  assertStrictEquals(calls[0].client, token);
  assertStrictEquals(calls[0].methodArgs, input);
  assertEquals(await other.balance.read({ owner: "bob" }), 42n);
  assertStrictEquals(calls[1].client, other);
  assertEquals(await token.ping.read(), null);
  for (const [helper, method] of [
    [token.readMethodMethod, "read"], [token.readMethod, "readMethod"],
    [token.invokeMethod, "invoke"], [token.eventsMethod, "events"],
    [token.rpcMethod, "rpc"], [token.getSpecMethod, "getSpec"],
    [token.requireMethod, "require"], [token.constructorMethod, "constructor"],
    [token.__proto__Method, "__proto__"], [token.thenMethod, "then"],
    [token.grant_role, "grant_role"],
  ] as const) {
    assertEquals(await helper.read(), null);
    assertEquals(calls.at(-1)!.method, method);
  }
  assertEquals(Object.getPrototypeOf(token), Token.prototype);
  assertEquals(token.getSpec().funcs().length, ${spec.funcs().length});
  assertEquals(token.events.Transfer.name, "Transfer");
  assertEquals(await Promise.resolve(token), token);
  const raw = { hash: "abc", ledger: 1, createdAt: 2, returnValue: nativeToScVal(42n, { type: "i128" }), response: {} } as InvokeContractOutput;
  let submitted: Parameters<Contract["invoke"]>[0] | undefined;
  let submissions = 0;
  Contract.prototype.invoke = async function(args) { submissions++; submitted = args; return raw; };
  const result = await detachedInvoke({ methodArgs: input, ...options });
  assertEquals(submitted, { ...options, method: "balance", methodArgs: input });
  assertStrictEquals(submitted!.config, options.config);
  assertStrictEquals(submitted!.auth, options.auth);
  assertStrictEquals<object | undefined>(submitted!.methodArgs, input);
  assertEquals(result.value, 42n);
  assertEquals(result.hash, raw.hash);
  assertStrictEquals(result.returnValue, raw.returnValue);
  const poisoned = { ...options, method: "ping", methodArgs: input };
  await token.balance.invoke(poisoned);
  assertEquals(submitted!.method, "balance");
  assertEquals(submitted!.methodArgs, input);
  const invalid = { ...raw, returnValue: xdr.ScVal.scvString("wrong ABI") };
  Contract.prototype.invoke = async () => { submissions++; return invalid; };
  const before = submissions;
  const failure = await assertRejects(() => token.balance.invoke({ methodArgs: input, ...options }), ColibriError);
  assertEquals(failure.code, "CONTR_021");
  assertStrictEquals((failure.meta?.data as { result: InvokeContractOutput }).result, invalid);
  assertEquals(submissions, before + 1);
  Contract.prototype.invoke = async function(args) { submitted = args; return { ...raw, returnValue: xdr.ScVal.scvVoid() }; };
  assertEquals((await token.ping.invoke({ ...options, method: "balance" } as TokenInvocation)).value, null);
  assertEquals(submitted!.method, "ping");
  assertEquals(submitted!.methodArgs, undefined);
  assertEquals((await token.ping.invoke({ ...options, methodArgs: {} })).value, null);
  assertEquals(submitted!.methodArgs, {});
  Contract.prototype.invoke = async () => ({ ...raw, returnValue: undefined });
  assertEquals((await token.ping.invoke(options)).value, undefined);
  const pipelineFailure = new Error("pipeline failure");
  Contract.prototype.invoke = () => Promise.reject(pipelineFailure);
  assertEquals(await assertRejects(() => token.balance.invoke({ methodArgs: input, ...options })), pipelineFailure);
} finally {
  Contract.prototype.read = read;
  Contract.prototype.invoke = invoke;
}
`,
      );
      const result = await new Deno.Command(Deno.execPath(), {
        args: [
          "run",
          "--check",
          "--config",
          fileURLToPath(new URL("../../../deno.json", import.meta.url)),
          `${directory}/consumer.ts`,
        ],
        stdout: "piped",
        stderr: "piped",
      }).output();
      assertEquals(
        result.code,
        0,
        new TextDecoder().decode(result.stdout) +
          new TextDecoder().decode(result.stderr),
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
