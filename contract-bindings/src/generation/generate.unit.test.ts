import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { extractContractSpec } from "@colibri/core";
import { generateBindings } from "@/generation/generate.ts";
import { BindingError } from "@/error.ts";
import { doc, identifier, TypeMap, typeName } from "@/generation/type-map.ts";
import { bindingSpec } from "colibri-internal/tests/binding-fixtures.ts";

describe("bindings rendering", () => {
  it("renders deterministic clients with full method maps, events, specs and error configuration", () => {
    const spec = bindingSpec();
    const plan = generateBindings(spec, { className: "Token" });
    assertEquals(generateBindings(spec, { className: "Token" }), plan);
    const source = Object.values(plan.files).join("\n");
    for (
      const text of [
        "extends Contract",
        "TokenMethodMap",
        "TokenInputs",
        "TokenOutputs",
        "TokenErrors",
        "TokenEvents",
        "readonly Transfer",
        "override async read",
        "override async invoke",
        "result.returnValue",
        "contractConfig.plugins",
        "amount: bigint",
      ]
    ) assert(source.includes(text), text);
    assert(!source.includes("async balance("));
    assertEquals(plan.warnings, []);
  });
  it("omits provenance unless explicitly provided, in files and packages", () => {
    for (const output of ["files", "package"] as const) {
      const options = {
        className: "Token",
        output,
        packageName: "@example/token",
      };
      const lean = generateBindings(bindingSpec(), options);
      assert(!JSON.stringify(lean).includes("TokenProvenance"));
      assert(!lean.scaffold["README.md"].includes("source identity"));
      const full = generateBindings(bindingSpec(), {
        ...options,
        provenance: { kind: "wasm", wasmHash: "ab".repeat(32) },
      });
      const constants = full.files[
        output === "package" ? "generated/constants.ts" : "constants.ts"
      ];
      assert(constants.includes("TokenProvenance"));
      assert(constants.includes("ab".repeat(32)));
      assert(full.scaffold["README.md"].includes("TokenProvenance"));
    }
  });
  it("renders registry presets and preserves scaffold as a distinct output category", () => {
    for (const target of ["npm", "jsr"] as const) {
      const plan = generateBindings(bindingSpec(), {
        output: "package",
        target,
        packageName: "@example/token",
      });
      assertEquals(Object.keys(plan.files), [
        "generated/constants.ts",
        "generated/types.ts",
        "generated/index.ts",
      ]);
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
      assert(
        Object.values(plan.files).join("\n").includes("ContractClientSpec"),
      );
      if (name === "errors_contract") {
        assert(
          Object.values(plan.files).join("\n").includes("TwoHundredSixtyFive"),
        );
      }
      assert(
        plan.warnings.some((warning) =>
          warning.includes("No event declarations")
        ),
      );
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
      "StellarResult<number, { message: string }>",
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
  it("uses PascalCase ABI names and propagates only necessary input variants", () => {
    assertEquals(typeName("counter_summary"), "CounterSummary");
    assertEquals(typeName("get_count"), "GetCount");
    const entry = (name: string, type: xdr.ScSpecTypeDef) =>
      xdr.ScSpecEntry.scSpecEntryUdtStructV0(
        new xdr.ScSpecUdtStructV0({
          name,
          lib: "",
          doc: "Named contract type.",
          fields: [
            new xdr.ScSpecUdtStructFieldV0({ name: "value", doc: "", type }),
          ],
        }),
      );
    const group = entry(
      "group",
      xdr.ScSpecTypeDef.scSpecTypeOption(
        new xdr.ScSpecTypeOption({
          valueType: xdr.ScSpecTypeDef.scSpecTypeU32(),
        }),
      ),
    );
    const envelope = entry(
      "envelope",
      xdr.ScSpecTypeDef.scSpecTypeUdt(new xdr.ScSpecTypeUdt({ name: "group" })),
    );
    const model = new TypeMap(new Spec([envelope, group]));
    assert(model.declarations().includes("export type Group ="));
    assert(model.declarations().includes("export type GroupInput ="));
    assert(model.declarations().includes("export type EnvelopeInput ="));
    assert(!model.declarations().includes("GroupOutput"));
    assertThrows(
      () =>
        new TypeMap(
          new Spec([group, entry("Group", xdr.ScSpecTypeDef.scSpecTypeU32())]),
        ),
      BindingError,
      "collision",
    );
    const repeated = new TypeMap(new Spec([group, group]));
    assertEquals(repeated.aliases.size, 1);
    assertEquals(repeated.warnings.length, 1);
  });
});
