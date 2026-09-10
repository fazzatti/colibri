import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { validateCliValue } from "@/cli/validation.ts";
import { BindingError } from "@/error.ts";
import { contractId } from "colibri-internal/tests/binding-fixtures.ts";

describe("CLI field validation", () => {
  it("checks contract checksums, hash length, menu values and nonblank text", async () => {
    for (
      const [key, value] of [
        ["contract-id", "decodeInvocationResult"],
        ["contract-id", contractId.slice(0, -1) + "A"],
        [
          "contract-id",
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        ],
        ["wasm-hash", "ab"],
        ["wasm-hash", "z".repeat(64)],
        ["wasm-hash", "a".repeat(65)],
        ["source", "typo"],
        ["network", "typo"],
        ["output", "typo"],
        ["target", "typo"],
        ["network-passphrase", " \t"],
      ]
    ) assert(typeof await validateCliValue(key, value, {}) === "string", key);
    for (
      const [key, value] of [
        ["contract-id", contractId],
        ["wasm-hash", "Ab".repeat(32)],
        ["source", "wasm"],
        ["network", "mainnet"],
        ["output", "package"],
        ["target", "npm"],
        ["network-passphrase", "Custom network"],
      ]
    ) assertEquals(await validateCliValue(key, value, {}), true);
  });

  it("checks complete RPC URLs and the explicit HTTP opt-in without contacting them", async () => {
    for (
      const value of [
        "rpc.example.com",
        "function_name",
        "ftp://example.com",
        "http://localhost:8000",
      ]
    ) {
      assert(typeof await validateCliValue("rpc-url", value, {}) === "string");
    }
    assertEquals(
      await validateCliValue(
        "rpc-url",
        "https://rpc.example.com/path?key=example",
        {},
      ),
      true,
    );
    assertEquals(
      await validateCliValue("rpc-url", "http://localhost:8000", {
        "allow-http": true,
      }),
      true,
    );
  });

  it("shares class and registry naming rules with the renderer", async () => {
    for (
      const value of [
        "Contract",
        "ContractMethods",
        "Spec",
        "bad name",
        "class",
        "unknown",
        "any",
        "never",
        "Object",
        "ContractId",
        "Promise",
        "Map",
        "Array",
        "Record",
      ]
    ) {
      assert(
        typeof await validateCliValue("class-name", value, {}) === "string",
      );
    }
    assertEquals(await validateCliValue("class-name", "Token", {}), true);
    for (const value of ["BadName", "../token", "@scope/", "token"]) {
      assert(
        typeof await validateCliValue("package-name", value, {
          target: "jsr",
        }) === "string",
      );
    }
    assertEquals(
      await validateCliValue("package-name", "@scope/token", { target: "jsr" }),
      true,
    );
    assertEquals(
      await validateCliValue("package-name", "token", { target: "npm" }),
      true,
    );
    // A target not chosen yet validates syntax; scope is checked after selecting JSR.
    assertEquals(await validateCliValue("package-name", "token", {}), true);
  });

  it("checks readable input files and directory parents without creating output", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const file = `${directory}/token.wasm`;
      await Deno.copyFile(
        "_internal/tests/compiled-contracts/types_harness.wasm",
        file,
      );
      assertEquals(await validateCliValue("wasm", file, {}), true);
      for (const path of [directory, `${directory}/missing.wasm`, "a\0b"]) {
        assert(typeof await validateCliValue("wasm", path, {}) === "string");
      }
      for (const path of [file, `${file}/child`, "a\0b"]) {
        assert(typeof await validateCliValue("out", path, {}) === "string");
      }
      assertEquals(await validateCliValue("out", directory, {}), true);
      const output = `${directory}/new/nested`;
      assertEquals(await validateCliValue("out", output, {}), true);
      await assertRejects(() => Deno.stat(output), Deno.errors.NotFound);
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("explains missing Deno permissions instead of retrying an unfixable prompt", async () => {
    using _open = stub(
      Deno,
      "open",
      () => Promise.reject(new Deno.errors.NotCapable("read denied")),
    );
    await assertRejects(
      () => validateCliValue("wasm", "token.wasm", {}),
      BindingError,
      "--allow-read",
    );
  });
});
