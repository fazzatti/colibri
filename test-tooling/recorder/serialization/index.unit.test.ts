import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { snapshot } from "@/recorder/serialization/index.ts";

describe("evidence snapshots", () => {
  it("redacts secrets and skips getters and client traversal", () => {
    const value = {
      secretKey: "never",
      signers: [{ seed: "never" }],
      signature: "never",
      get dangerous() {
        throw new TypeError("never evaluate");
      },
      client: new Map(),
      amount: 1234567890123456789n,
      bytes: new Uint8Array(3),
    };
    assertEquals(snapshot(value), {
      secretKey: "[redacted]",
      signers: "[redacted]",
      signature: "[redacted]",
      dangerous: "[accessor]",
      client: "[class instance]",
      amount: "1234567890123456789",
      bytes: "[bytes: 3]",
    });
  });
  it("bounds depth, entries, strings and cycles", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    assertEquals(snapshot(cyclic), { self: "[circular]" });
    assertEquals(snapshot([1, 2, 3], { limits: { entries: 2 } }), [
      1,
      2,
      "[1 entries omitted]",
    ]);
    assertEquals(snapshot({ a: 1, b: 2 }, { limits: { entries: 1 } }), {
      a: 1,
      "[truncated]": 1,
    });
    assertEquals(snapshot({ a: { b: 1 } }, { limits: { depth: 1 } }), {
      a: "[depth limit]",
    });
    assertStringIncludes(
      String(snapshot("abcd", { limits: { stringLength: 2 } })),
      "ab…[truncated]",
    );
  });
  it("supports unusual scalars, null-prototype objects and error causes", () => {
    const values = [undefined, Infinity, false, Symbol("x"), () => 1];
    assertEquals(snapshot(values), [
      null,
      "Infinity",
      false,
      "[symbol]",
      "[function]",
    ]);
    const error = new TypeError("outer", { cause: new TypeError("inner") });
    const result = JSON.stringify(snapshot(error));
    assertStringIncludes(result, "outer");
    assertStringIncludes(result, "inner");
    assertEquals(snapshot(Object.assign(Object.create(null), { ok: true })), {
      ok: true,
    });
  });
});
