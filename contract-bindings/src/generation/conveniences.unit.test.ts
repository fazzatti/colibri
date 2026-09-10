import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Spec } from "@colibri/core";
import { generateBindings } from "@/generation/generate.ts";
import { renderConvenienceExports } from "@/generation/conveniences.ts";
import {
  func,
  struct,
} from "colibri-internal/tests/soroban-values-fixtures.ts";

describe("generated Colibri conveniences", () => {
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
