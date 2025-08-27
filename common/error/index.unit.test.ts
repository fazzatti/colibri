import {
  assert,
  assertEquals,
  assertObjectMatch,
  assertStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "./index.ts";
import type { BaseMeta, ColibriErrorShape, Diagnostic } from "./types.ts";

describe("ColibriError", () => {
  describe("constructor", () => {
    it("sets fields and instanceof works", () => {
      const diagnostic: Diagnostic = {
        info: "invalid key",
        diagnosticCode: "ACC_001",
        rootCause: "bad format",
        suggestion: "use a valid G... public key",
      };
      const meta: BaseMeta = { data: { accountId: "GABC" } };
      const shape: ColibriErrorShape<"ACC_001", BaseMeta> = {
        domain: "accounts",
        source: "@colibri/accounts",
        code: "ACC_001",
        message: "Invalid account key",
        details: "malformed key",
        diagnostic,
        meta,
      };

      const e = new ColibriError(shape);

      assert(e instanceof Error);
      assert(e instanceof ColibriError);
      assertStrictEquals(e.name, "ColibriError");
      assertStrictEquals(e.domain, "accounts");
      assertStrictEquals(e.source, "@colibri/accounts");
      assertStrictEquals(e.code, "ACC_001");
      assertStrictEquals(e.message, "Invalid account key");
      assertStrictEquals(e.details, "malformed key");
      assertObjectMatch(e.diagnostic!, diagnostic);
      assertObjectMatch(e.meta!, meta);
    });
  });

  describe("toJSON", () => {
    it("returns a plain snapshot of fields", () => {
      const e = new ColibriError({
        domain: "core",
        source: "colibri",
        code: "GEN_000",
        message: "Unexpected error",
        details: "boom",
        meta: { data: { x: 1 } },
        diagnostic: {
          info: "info",
          diagnosticCode: "GEN",
          rootCause: "root",
          suggestion: "fix",
        },
      });

      const j = e.toJSON();
      assertEquals(j.name, "ColibriError");
      assertEquals(j.domain, "core");
      assertEquals(j.code, "GEN_000");
      assertEquals(j.message, "Unexpected error");
      assertEquals(j.source, "colibri");
      assertEquals(j.details, "boom");
      assertObjectMatch(j.meta!, { data: { x: 1 } });
      assertObjectMatch(j.diagnostic!, {
        info: "info",
        diagnosticCode: "GEN",
        rootCause: "root",
        suggestion: "fix",
      });
    });
  });

  describe("is", () => {
    it("type guard detects ColibriError", () => {
      const e = new ColibriError({
        domain: "core",
        source: "colibri",
        code: "GEN_000",
        message: "m",
      });
      assert(ColibriError.is(e));
      assert(!ColibriError.is(new Error("x")));
      assert(!ColibriError.is({}));
    });
  });

  describe("unexpected", () => {
    it("builds a core generic error and preserves cause", () => {
      const cause = new Error("disk not found");
      const e = ColibriError.unexpected({
        message: "fail",
        details: "ctx",
        source: "@colibri/test",
        meta: { data: { id: 7 } },
        cause,
      });

      assert(e instanceof ColibriError);
      assertEquals(e.domain, "core");
      assertEquals(e.source, "@colibri/test");
      assertEquals(e.code, "GEN_000");
      assertEquals(e.message, "fail");
      assertEquals(e.details, "ctx");
      assertStrictEquals(e.meta?.cause, cause);
      assertObjectMatch(e.meta!.data as Record<string, unknown>, { id: 7 });
    });
  });

  describe("fromUnknown", () => {
    it("returns same instance for ColibriError", () => {
      const original = new ColibriError({
        domain: "rpc",
        source: "@colibri/rpc",
        code: "RPC_001",
        message: "rpc failed",
      });
      const out = ColibriError.fromUnknown(original);
      assertStrictEquals(out, original);
    });

    it("wraps native Error and keeps stack in details and cause in meta", () => {
      const native = new Error("boom");
      const wrapped = ColibriError.fromUnknown(native, {
        domain: "accounts",
        source: "@colibri/accounts",
        code: "ACC_999",
      });

      assert(wrapped instanceof ColibriError);
      assertEquals(wrapped.domain, "accounts");
      assertEquals(wrapped.source, "@colibri/accounts");
      assertEquals(wrapped.code, "ACC_999");
      assertEquals(wrapped.message, "boom");
      assert(typeof wrapped.details === "string"); // stack string
      assertStrictEquals(wrapped.meta?.cause, native);
    });

    it("uses unexpected with provided context for non-error values", () => {
      const wrapped = ColibriError.fromUnknown(42, {
        domain: "pipelines",
        source: "@colibri/pipelines",
        message: "bad input",
      });

      assert(wrapped instanceof ColibriError);
      assertEquals(wrapped.domain, "pipelines");
      assertEquals(wrapped.source, "@colibri/pipelines");
      assertEquals(wrapped.code, "GEN_000");
      assertEquals(wrapped.message, "bad input");
      assertStrictEquals(wrapped.meta?.cause, 42);
    });
  });
});
