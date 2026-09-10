import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Contract, NetworkConfig, Spec } from "@colibri/core";
import { xdr } from "stellar-sdk";
import { methodBindings, methodName } from "@/generation/method-clients.ts";
import { generateBindings } from "@/generation/generate.ts";
import {
  bindingSpec,
  contractId,
  errorEntry,
} from "colibri-internal/tests/binding-fixtures.ts";
import { func } from "colibri-internal/tests/soroban-values-fixtures.ts";

describe("method client generation", () => {
  it("uses camelCase and documents collisions without claiming another method's name", () => {
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
      ["__proto__", "proto"],
      ["then", "thenMethod"],
      ["grant_role", "grantRole"],
    ]);
    const plan = generateBindings(spec, { className: "Token" });
    const source = plan.files["index.ts"];
    assert(source.includes('readonly balance: TokenMethod<"balance">'));
    assert(source.includes('readonly readMethodMethod: TokenMethod<"read">'));
    assert(source.includes('readonly grantRole: TokenMethod<"grant_role">'));
    assertEquals(plan.warnings.length, 3);
    assert(
      plan.warnings.some((warning) =>
        warning.includes("client.readMethodMethod")
      ),
    );
    assert(plan.scaffold["README.md"].includes("`client.readMethodMethod`"));
    assert(plan.scaffold["README.md"].includes("client.ping.read()"));
    assert(
      plan.scaffold["README.md"].includes(
        'methodArgs: { owner: "example" },',
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

  it("normalizes separators and acronyms while preserving existing camelCase", () => {
    for (
      const [name, expected] of [
        ["grant_role", "grantRole"],
        ["getRoleAdmin", "getRoleAdmin"],
        ["GrantRole", "grantRole"],
        ["TTL_CONFIG", "ttlConfig"],
        ["getURL", "getUrl"],
        ["URLValue", "urlValue"],
        ["__constructor", "constructor"],
        ["__proto__", "proto"],
        ["set_2fa", "set2fa"],
      ]
    ) assertEquals(methodName(name), expected);
  });

  it("resolves normalized collisions deterministically in spec order", () => {
    for (
      const names of [
        ["grant_role", "GRANT_ROLE", "grantRoleMethod"],
        ["GRANT_ROLE", "grant_role", "grantRoleMethod"],
      ]
    ) {
      const spec = new Spec(names.map((name) => func(name, {})));
      assertEquals(methodBindings(spec).map(({ property }) => property), [
        "grantRole",
        "grantRoleMethodMethod",
        "grantRoleMethod",
      ]);
      const plan = generateBindings(spec);
      assert(
        plan.warnings.some((warning) =>
          warning.includes("client.grantRoleMethodMethod")
        ),
      );
    }
  });

  it("excludes deployment constructors from helpers, constants and calls but retains their spec and inputs", () => {
    const spec = new Spec([
      func("__constructor", {
        initial_count: xdr.ScSpecTypeDef.scSpecTypeU32(),
      }),
    ]);
    const plan = generateBindings(spec);
    assertEquals(methodBindings(spec), []);
    assert(!plan.files["index.ts"].includes("readonly "));
    assert(
      !plan.files["constants.ts"].includes('Constructor = "__constructor"'),
    );
    assert(
      plan.files["constants.ts"].includes(spec.entries[0].toXdr("base64")),
    );
    const types = plan.files["types.ts"];
    assert(types.includes("export type ConstructorInput = {"));
    assert(types.includes("initial_count:"));
    assert(!types.includes("ConstructorOutput"));
    assert(!types.includes("__constructor: {"));
    assert(plan.scaffold["README.md"].includes("ConstructorInput"));
    assert(!plan.scaffold["README.md"].includes("client.__constructor"));
  });

  it("renders empty specs and normalized method properties without a runtime lookup table", () => {
    const empty = generateBindings(new Spec([errorEntry()]));
    assert(!empty.files["index.ts"].includes("readonly "));
    const quoted = generateBindings(new Spec([func("quote-name", {})]));
    assert(quoted.files["index.ts"].includes("readonly quoteName:"));
    assert(
      quoted.scaffold["README.md"].includes("client.quoteName.read()"),
    );
  });
});
