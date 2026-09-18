import { assert, assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Spec } from "@colibri/core";
import { generateBindings } from "@/generation/generate.ts";
import { renderConvenienceExports } from "@/generation/conveniences.ts";
import { BindingError } from "@/error.ts";
import type { GenerateBindingsOptions } from "@/types.ts";
import {
  func,
  struct,
} from "colibri-internal/tests/soroban-values-fixtures.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("generated Colibri conveniences", () => {
  it("keeps convenience output enabled by default and when explicitly requested", () => {
    const spec = new Spec([func("ping", {})]);
    for (const output of ["files", "package"] as const) {
      for (const target of ["jsr", "npm"] as const) {
        const options = { output, target, packageName: "@example/token" };
        assertEquals(
          generateBindings(spec, { ...options, includeColibri: true }),
          generateBindings(spec, options),
        );
      }
    }
  });

  it("omits convenience files, client exports and package subpaths in every output preset", () => {
    const spec = new Spec([struct("NetworkConfig", {}), func("ping", {})]);
    for (const output of ["files", "package"] as const) {
      for (const target of ["jsr", "npm"] as const) {
        const options = { output, target, packageName: "@example/token" };
        const enabled = generateBindings(spec, options);
        const plan = generateBindings(spec, {
          ...options,
          includeColibri: false,
        });
        const prefix = output === "package" ? "generated/" : "";
        assertEquals(Object.keys(plan.files), [
          `${prefix}constants.ts`,
          `${prefix}types.ts`,
          `${prefix}index.ts`,
        ]);
        for (const file of ["constants.ts", "types.ts"]) {
          assertEquals(plan.files[prefix + file], enabled.files[prefix + file]);
        }
        assert(!plan.files[`${prefix}index.ts`].includes("./colibri.ts"));
        const guide = plan.scaffold["README.md"];
        assert(!guide.includes("colibri.ts"));
        assert(
          guide.includes('import { NetworkConfig } from "@colibri/core";'),
        );
        assert(guide.includes("Import `SorobanType` from `@colibri/core`"));
        assert(guide.includes("Core remains a runtime dependency"));
        if (output === "package") {
          const manifest = JSON.parse(
            plan.scaffold[target === "jsr" ? "deno.json" : "package.json"],
          );
          assertEquals(Object.keys(manifest.exports), ["."]);
          assert(
            (target === "jsr" ? manifest.imports : manifest.dependencies)[
              "@colibri/core"
            ],
          );
          assertEquals(plan.scaffold["mod.ts"], enabled.scaffold["mod.ts"]);
        }
      }
    }
  });

  it("rejects non-boolean includeColibri options from JavaScript callers", () => {
    for (const includeColibri of [null, "false", 0]) {
      const error = assertThrows(
        () =>
          generateBindings(
            new Spec([func("ping", {})]),
            { includeColibri } as unknown as GenerateBindingsOptions,
          ),
        BindingError,
        "includeColibri must be a boolean",
      );
      assertEquals(error.code, "CBG_001");
    }
  });

  it("preserves ABI and client names when conveniences share them", () => {
    const plan = generateBindings(
      new Spec([
        struct("NetworkConfig", {}),
        struct("Signer", {}),
        func("signer", {}),
      ]),
      { className: "LocalSigner" },
    );
    const client = plan.files["index.ts"];
    const conveniences = plan.files["colibri.ts"];
    assert(client.includes("export class LocalSigner extends Contract"));
    assert(!client.includes("  NetworkConfig,"));
    assert(!client.includes("  LocalSigner,"));
    assert(!client.includes("  Signer,"));
    for (const name of ["NetworkConfig", "LocalSigner", "Signer"]) {
      assert(conveniences.includes(`  ${name},`));
    }
    assert(plan.files["types.ts"].includes("export type SignerInput ="));
    assert(plan.files["types.ts"].includes("export type NetworkConfig ="));
    assert(plan.scaffold["README.md"].includes("ABI names take precedence"));
    assert(plan.scaffold["README.md"].includes("[colibri.ts](colibri.ts)"));
  });

  it("exports the conveniences subpath in both package presets", () => {
    for (const target of ["jsr", "npm"] as const) {
      const plan = generateBindings(new Spec([func("ping", {})]), {
        output: "package",
        target,
        packageName: "@example/token",
      });
      const manifest = JSON.parse(
        plan.scaffold[target === "jsr" ? "deno.json" : "package.json"],
      );
      assertEquals(
        manifest.exports["./colibri"],
        target === "jsr" ? "./generated/colibri.ts" : {
          types: "./dist/generated/colibri.d.ts",
          import: "./dist/generated/colibri.js",
        },
      );
      assert(
        plan.files["generated/colibri.ts"].includes('from "@colibri/core"'),
      );
    }
  });

  it("can omit conflicting runtime and type exports independently", () => {
    const values = [
      "ColibriError",
      "LocalSigner",
      "NetworkConfig",
      "SorobanType",
    ];
    const types = [
      "AuthEntrySigner",
      "ContractConfig",
      "ContractConstructorArgs",
      "ContractId",
      "Ed25519PublicKey",
      "EnvelopeSigner",
      "KeypairSigner",
      "Signer",
      "TransactionConfig",
    ];
    assert(!renderConvenienceExports(new Set(values)).startsWith("export {"));
    assert(!renderConvenienceExports(new Set(types)).includes("export type"));
    assertEquals(renderConvenienceExports(new Set([...values, ...types])), "");
  });
});
