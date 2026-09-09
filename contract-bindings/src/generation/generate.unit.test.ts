import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { extractContractSpec } from "@colibri/core";
import { generateBindings } from "@/generation/generate.ts";
import { BindingError } from "@/error.ts";
import { doc, identifier, TypeMap, typeName } from "@/generation/type-map.ts";
import {
  bindingSpec,
  errorEntry,
} from "colibri-internal/tests/binding-fixtures.ts";

import {
  union,
  valueSpec,
} from "colibri-internal/tests/soroban-values-fixtures.ts";

const numericEnum = (cases: Record<string, number>): xdr.ScSpecEntry =>
  xdr.ScSpecEntry.scSpecEntryUdtEnumV0(
    new xdr.ScSpecUdtEnumV0({
      name: "Status",
      lib: "",
      doc: "Workflow status.",
      cases: Object.entries(cases).map(([name, value]) =>
        new xdr.ScSpecUdtEnumCaseV0({
          name,
          value,
          doc: name === "Closed" ? "Finished." : "",
        })
      ),
    }),
  );

describe("bindings rendering", () => {
  it("renders custom schemas without expanding variants or duplicating input fields", () => {
    const source = generateBindings(
      new Spec([
        ...valueSpec().entries,
        numericEnum({ Closed: 20, Pending: 1, Active: 10 }),
      ]),
    ).files["types.ts"];
    for (
      const text of [
        "export type RbacStorage = SorobanType.Custom<{",
        'encoding: "tagged";',
        "ExistingRoles: SorobanType.Void;",
        "EmptyTuple: [];",
        "RoleIndexToAccount: [SorobanType.Symbol, SorobanType.U32];",
        "export type RbacStorageInput = SorobanType.Input.Custom<RbacStorage>;",
        'kind: "tuple";\n  fields: [SorobanType.Symbol, SorobanType.U32];',
        "next: SorobanType.Option<Node>;",
        'encoding: "u32";',
        "/** Finished. */\n    Closed: 20;\n    Pending: 1;\n    Active: 10;",
        "export const Status: SorobanType.Factory<Status>",
      ]
    ) assert(source.includes(text), text);
    assert(!source.includes('tag: "RoleIndexToAccount"'));
    assert(!source.includes("StatusType"));
  });
  it("rejects enum names that would replace validation methods", () => {
    for (const name of ["type", "from", "fromScVal", "fromXdr"]) {
      for (
        const entry of [
          numericEnum({ [name]: 1 }),
          union("Status", { [name]: null }),
        ]
      ) {
        assertThrows(
          () => generateBindings(new Spec([entry])),
          BindingError,
          "conflicts with factory member",
        );
      }
    }
  });
  it("uses PascalCase enum members with exact ABI values and rejects casing collisions", () => {
    const method = (name: string) =>
      xdr.ScSpecEntry.scSpecEntryFunctionV0(
        new xdr.ScSpecFunctionV0({ name, doc: "", inputs: [], outputs: [] }),
      );
    const plan = generateBindings(
      new Spec([
        method("grant_role"),
        method("__constructor"),
        method("__proto__"),
      ]),
    );
    assert(plan.files["constants.ts"].includes("export enum ContractMethods"));
    assert(plan.files["constants.ts"].includes('GrantRole = "grant_role"'));
    assert(
      plan.files["constants.ts"].includes('Constructor = "__constructor"'),
    );
    assert(plan.files["constants.ts"].includes('Proto = "__proto__"'));
    assert(!plan.files["constants.ts"].includes("ContractClientMethods"));
    assertThrows(
      () =>
        generateBindings(
          new Spec([
            method("grant_role"),
            method("GrantRole"),
          ]),
        ),
      BindingError,
      "collision",
    );
    assertThrows(
      () => generateBindings(bindingSpec(), { className: "ContractMethods" }),
      BindingError,
      "collision",
    );
  });
  it("emits error metadata without duplicate enums, preserving types used by the ABI", () => {
    const entries = [errorEntry("access_error"), errorEntry("UnusedError", 2)];
    const unused = generateBindings(new Spec(entries));
    assert(!unused.files["types.ts"].includes("AccessError"));
    assert(!unused.files["types.ts"].includes("UnusedError"));
    assert(unused.files["constants.ts"].includes('"category": "access_error"'));
    assert(unused.files["constants.ts"].includes('"name": "Unauthorized"'));
    assert(
      unused.files["constants.ts"].includes(
        "as const satisfies ContractErrorMap",
      ),
    );
    const udt = xdr.ScSpecTypeDef.scSpecTypeUdt(
      new xdr.ScSpecTypeUdt({ name: "access_error" }),
    );
    const used = generateBindings(
      new Spec([
        ...entries,
        xdr.ScSpecEntry.scSpecEntryFunctionV0(
          new xdr.ScSpecFunctionV0({
            name: "echo_error",
            doc: "",
            inputs: [
              new xdr.ScSpecFunctionInputV0({
                name: "error",
                doc: "",
                type: udt,
              }),
            ],
            outputs: [udt],
          }),
        ),
      ]),
    );
    assert(
      used.files["types.ts"].includes(
        'export type AccessError = SorobanType.ErrorCode<typeof ContractClientErrors, "access_error">;',
      ),
    );
    assert(
      used.files["types.ts"].includes(
        "error: SorobanType.Input.Value<AccessError>",
      ),
    );
    assert(!used.files["types.ts"].includes("export enum AccessError"));
    assert(!used.files["types.ts"].includes("UnusedError"));
  });
  it("generates clients and package manifests with only Core as a runtime dependency", () => {
    for (const target of ["jsr", "npm"] as const) {
      const plan = generateBindings(bindingSpec(), {
        className: "Token",
        output: "package",
        target,
        packageName: "@example/token",
      });
      const source = Object.values(plan.files).join("\n");
      assert(source.includes('import { Spec } from "@colibri/core"'));
      assert(!source.includes("stellar-sdk"));
      const manifest = JSON.parse(
        plan.scaffold[target === "npm" ? "package.json" : "deno.json"],
      );
      assertEquals(
        Object.keys(
          target === "npm" ? manifest.dependencies : manifest.imports,
        ),
        ["@colibri/core"],
      );
    }
  });
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
        "this.decodeInvocationResult",
        "contractConfig.plugins",
        "amount: SorobanType.I128",
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
    for (
      const className of [
        "class",
        "1Token",
        "Spec",
        "ContractErrorMap",
        "Token;alert(1)",
      ]
    ) {
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
      "SorobanType.Input.Map<SorobanType.Input.U32, SorobanType.Input.U32, SorobanType.U32, SorobanType.U32>",
    );
    assertEquals(
      map.type(type, "Output"),
      "SorobanType.Map<SorobanType.U32, SorobanType.U32>",
    );
    const option = xdr.ScSpecTypeDef.scSpecTypeOption(
      new xdr.ScSpecTypeOption({ valueType: u32 }),
    );
    assertEquals(
      map.type(option, "Input"),
      "SorobanType.Input.Option<SorobanType.Input.U32, SorobanType.U32>",
    );
    assertEquals(
      map.type(option, "Output"),
      "SorobanType.Option<SorobanType.U32>",
    );
    const result = xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({
        okType: u32,
        errorType: xdr.ScSpecTypeDef.scSpecTypeError(),
      }),
    );
    assertEquals(
      map.type(result, "Output", true),
      "StellarResult<SorobanType.U32, { message: string }>",
    );
    assertEquals(
      map.type(result, "Input"),
      "SorobanType.Input.Result<SorobanType.Input.U32, SorobanType.Input.Error, SorobanType.U32, SorobanType.Error>",
    );
    assertEquals(
      map.type(xdr.ScSpecTypeDef.scSpecTypeError(), "Output"),
      "SorobanType.Error",
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
    assert(
      model.declarations("ContractClient").includes("export type Group ="),
    );
    assert(
      model.declarations("ContractClient").includes("export type GroupInput ="),
    );
    assert(
      model.declarations("ContractClient").includes(
        "export type EnvelopeInput =",
      ),
    );
    assert(!model.declarations("ContractClient").includes("GroupOutput"));
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
