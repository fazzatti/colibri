import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { extractContractSpec } from "@colibri/core";
import { generateBindings } from "@/generate.ts";
import { BindingError } from "@/error.ts";
import { doc, identifier, TypeMap } from "@/type-map.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";

describe("bindings rendering", () => {
  it("renders deterministic clients with full method maps, events, specs and error configuration", () => {
    const spec = bindingSpec();
    const plan = generateBindings(spec, { className: "Token" });
    assertEquals(generateBindings(spec, { className: "Token" }), plan);
    const source = plan.files["bindings.ts"];
    for (
      const text of [
        "extends Contract",
        "TokenABIMethods",
        "TokenABIInputs",
        "TokenABIOutputs",
        "TokenABIErrors",
        "TokenABIProvenance",
        "TokenABIEvents",
        'readonly "Transfer"',
        "override async read",
        "override async invoke",
        "result.returnValue",
        "contractConfig.plugins",
        '"amount": bigint',
      ]
    ) assert(source.includes(text), text);
    assert(!source.includes("async balance("));
    assertEquals(plan.warnings, []);
  });
  it("renders registry presets and preserves scaffold as a distinct output category", () => {
    for (const target of ["npm", "jsr"] as const) {
      const plan = generateBindings(bindingSpec(), {
        output: "package",
        target,
        packageName: "@example/token",
      });
      assertEquals(Object.keys(plan.files), ["generated/bindings.ts"]);
      assert(plan.scaffold["mod.ts"]);
      const manifest = JSON.parse(
        plan.scaffold[target === "npm" ? "package.json" : "deno.json"],
      );
      assertEquals(manifest.name, "@example/token");
      if (target === "npm") {
        assertEquals(manifest.type, "module");
        assertEquals(
          manifest.dependencies["@colibri/core"],
          "npm:@jsr/colibri__core@^1.1.0",
        );
        assert(plan.scaffold[".npmrc"].includes("https://npm.jsr.io"));
      }
    }
    for (const className of ["class", "1Token", "Spec", "Token;alert(1)"]) {
      assertThrows(
        () => generateBindings(bindingSpec(), { className }),
        BindingError,
      );
    }
    for (const packageName of [undefined, "Unscoped", "../x", "x;echo"]) {
      assertThrows(
        () =>
          generateBindings(bindingSpec(), { output: "package", packageName }),
        BindingError,
      );
    }
  });
  it("extracts real fixture ABIs including errors and duplicate dependency type names", async () => {
    for (
      const name of [
        "fungible_token_contract",
        "types_harness",
        "errors_contract",
      ]
    ) {
      const spec = extractContractSpec(
        await Deno.readFile(`_internal/tests/compiled-contracts/${name}.wasm`),
      );
      const plan = generateBindings(spec);
      assert(plan.files["bindings.ts"].includes("createContractClientABISpec"));
      if (name === "errors_contract") {
        assert(plan.files["bindings.ts"].includes("TwoHundredSixtyFive"));
      }
      assertEquals(plan.warnings.length, 1);
    }
  });
  it("matches the codec's direction-specific containers and result wrapper", () => {
    const map = new TypeMap(bindingSpec());
    const u32 = xdr.ScSpecTypeDef.scSpecTypeU32();
    const type = xdr.ScSpecTypeDef.scSpecTypeMap(
      new xdr.ScSpecTypeMap({ keyType: u32, valueType: u32 }),
    );
    assertEquals(
      map.type(type, "Input"),
      "Map<number, number> | Array<[number, number]>",
    );
    assertEquals(map.type(type, "Output"), "Array<[number, number]>");
    const option = xdr.ScSpecTypeDef.scSpecTypeOption(
      new xdr.ScSpecTypeOption({ valueType: u32 }),
    );
    assertEquals(map.type(option, "Input"), "(number) | null | undefined");
    assertEquals(map.type(option, "Output"), "(number) | null");
    const result = xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({
        okType: u32,
        errorType: xdr.ScSpecTypeDef.scSpecTypeError(),
      }),
    );
    assertEquals(
      map.type(result, "Output", true),
      "Result<number, { message: string }>",
    );
    assertThrows(() => map.type(result, "Input"), BindingError);
    assertThrows(
      () => map.type(xdr.ScSpecTypeDef.scSpecTypeError(), "Output"),
      BindingError,
    );
    assertThrows(
      () =>
        map.type(
          xdr.ScSpecTypeDef.scSpecTypeUdt(
            new xdr.ScSpecTypeUdt({ name: "Missing" }),
          ),
          "Input",
        ),
      BindingError,
    );
  });
  it("escapes ABI documentation and rejects ambiguous function maps", () => {
    assert(doc("*/\nexport {}", "fallback").includes("* /"));
    assertEquals(identifier("Token$"), true);
    const spec = bindingSpec();
    assertThrows(
      () => generateBindings(new Spec([...spec.entries, spec.entries[0]])),
      BindingError,
    );
  });
});
