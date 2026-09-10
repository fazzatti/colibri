import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Contract, NetworkConfig, Spec } from "@colibri/core";
import { methodBindings } from "@/generation/method-clients.ts";
import { generateBindings } from "@/generation/generate.ts";
import {
  bindingSpec,
  contractId,
  errorEntry,
} from "colibri-internal/tests/binding-fixtures.ts";
import { func } from "colibri-internal/tests/soroban-values-fixtures.ts";

describe("method client generation", () => {
  it("preserves ABI names and documents each collision without claiming another method's name", () => {
    const spec = new Spec([
      ...bindingSpec().entries,
      ...["read", "readMethod", "events", "__proto__", "then", "grant_role"]
        .map(
          (name) => func(name, {}),
        ),
    ]);
    const bindings = methodBindings(spec);
    assertEquals(bindings.map(({ name, property }) => [name, property]), [
      ["balance", "balance"],
      ["ping", "ping"],
      ["read", "readMethodMethod"],
      ["readMethod", "readMethod"],
      ["events", "eventsMethod"],
      ["__proto__", "__proto__Method"],
      ["then", "thenMethod"],
      ["grant_role", "grant_role"],
    ]);
    const plan = generateBindings(spec, { className: "Token" });
    const source = plan.files["index.ts"];
    assert(source.includes('readonly balance: TokenMethod<"balance">'));
    assert(source.includes('readonly readMethodMethod: TokenMethod<"read">'));
    assert(source.includes('readonly grant_role: TokenMethod<"grant_role">'));
    assertEquals(plan.warnings.length, 4);
    assert(
      plan.warnings.some((warning) =>
        warning.includes("client.readMethodMethod")
      ),
    );
    assert(plan.scaffold["README.md"].includes("`client.readMethodMethod`"));
    assert(plan.scaffold["README.md"].includes("client.ping.read()"));
    assert(
      plan.scaffold["README.md"].includes(
        'client.balance.invoke({ owner: "example" }, {',
      ),
    );
  });

  it("protects all current Contract instance fields and prototype members", () => {
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { contractId },
    });
    for (
      const name of new Set([
        ...Object.getOwnPropertyNames(contract),
        ...Object.getOwnPropertyNames(Contract.prototype),
        ...Object.getOwnPropertyNames(Object.prototype),
      ])
    ) {
      const [binding] = methodBindings(new Spec([func(name, {})]));
      assert(
        binding.property !== name,
        `${name} must keep its Contract behavior`,
      );
    }
  });

  it("renders empty specs and quoted method properties without a runtime lookup table", () => {
    const empty = generateBindings(new Spec([errorEntry()]));
    assert(!empty.files["index.ts"].includes("readonly "));
    const quoted = generateBindings(new Spec([func("quote-name", {})]));
    assert(quoted.files["index.ts"].includes('readonly "quote-name":'));
    assert(
      quoted.scaffold["README.md"].includes('client["quote-name"].read()'),
    );
  });
});
