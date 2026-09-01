import {
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core";
import { serializeBuildVerificationError } from "@/reporting/serialize-error.ts";

const serializedCause = (error: ColibriError): unknown =>
  (serializeBuildVerificationError(error).meta as Record<string, unknown>)
    .cause;

describe("build-verification error serialization", () => {
  it("redacts unknown causes without changing the in-memory error", () => {
    const coded = new Error("coded");
    Object.defineProperty(coded, "code", { value: "E_CODED" });
    const numbered = new Error("numbered");
    Object.defineProperty(numbered, "code", { value: 7 });
    const unreadableCode = new Error("unreadable code");
    Object.defineProperty(unreadableCode, "code", {
      get: () => {
        throw new Error("getter failed");
      },
    });
    const namedCause = function namedCause() {};
    const unnamedCause = () => {};
    Object.defineProperty(unnamedCause, "name", { value: "" });
    const unreadableType = new Proxy({}, {
      get: (target, property, receiver) => {
        if (property === "constructor") throw new Error("unreadable type");
        return Reflect.get(target, property, receiver);
      },
    });
    for (
      const [cause, expected] of [
        [undefined, undefined],
        [null, null],
        ["failed", "failed"],
        [true, true],
        [4, 4],
        [Number.POSITIVE_INFINITY, "Infinity"],
        [5n, { type: "bigint", value: "5" }],
        [Symbol("failed"), { type: "symbol", value: "Symbol(failed)" }],
        [namedCause, { type: "function", name: "namedCause" }],
        [unnamedCause, { type: "function", name: "anonymous" }],
        [new Error("plain"), { name: "Error", message: "plain" }],
        [coded, { name: "Error", message: "coded", code: "E_CODED" }],
        [numbered, { name: "Error", message: "numbered", code: 7 }],
        [
          unreadableCode,
          { name: "Error", message: "unreadable code" },
        ],
        [{}, { type: "Object" }],
        [Object.create(null), { type: "Object" }],
        [unreadableType, { type: "Object" }],
      ] as const
    ) {
      const error = ColibriError.unexpected({ cause });
      assertStrictEquals(error.meta?.cause, cause);
      assertEquals(serializedCause(error), expected);
      JSON.stringify(serializeBuildVerificationError(error));
    }
  });

  it("normalizes nested metadata, cycles, binary values, and depth", () => {
    const repeated = { safe: true };
    const getter = {} as Record<string, unknown>;
    Object.defineProperty(getter, "broken", {
      enumerable: true,
      get: () => {
        throw new Error("getter failed");
      },
    });
    const unreadable = new Proxy({}, {
      ownKeys: () => {
        throw new Error("keys failed");
      },
    });
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let index = 0; index < 40; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    const data: Record<string, unknown> = {
      null: null,
      text: "text",
      boolean: false,
      number: 3,
      nan: Number.NaN,
      bigint: 9n,
      omittedUndefined: undefined,
      omittedFunction: () => {},
      omittedSymbol: Symbol("omitted"),
      array: [undefined, () => {}, Symbol("omitted")],
      error: new Error("nested"),
      date: new Date("2026-09-01T00:00:00.000Z"),
      invalidDate: new Date(Number.NaN),
      buffer: new ArrayBuffer(4),
      bytes: new Uint8Array(3),
      first: repeated,
      second: repeated,
      getter,
      unreadable,
      deep,
    };
    data.self = data;

    const serialized = serializeBuildVerificationError(
      ColibriError.unexpected({ meta: { data } }),
    );
    const safe = (serialized.meta as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    assertEquals(safe.nan, "NaN");
    assertEquals(safe.bigint, { type: "bigint", value: "9" });
    assertEquals("omittedUndefined" in safe, false);
    assertEquals("omittedFunction" in safe, false);
    assertEquals("omittedSymbol" in safe, false);
    assertEquals(safe.array, [null, null, null]);
    assertEquals(safe.error, { name: "Error", message: "nested" });
    assertEquals(safe.date, "2026-09-01T00:00:00.000Z");
    assertEquals(safe.invalidDate, "Invalid Date");
    assertEquals(safe.buffer, { type: "ArrayBuffer", byteLength: 4 });
    assertEquals(safe.bytes, { type: "Uint8Array", byteLength: 3 });
    assertEquals(safe.first, { safe: true });
    assertEquals(safe.second, { safe: true });
    assertEquals(safe.getter, { broken: "[Unreadable value]" });
    assertEquals(safe.unreadable, "[Unreadable value]");
    assertEquals(safe.self, "[Circular]");
    assertStringIncludes(
      JSON.stringify(safe.deep),
      "[Maximum serialization depth exceeded]",
    );
  });

  it("falls back when a custom error snapshot is unusable", () => {
    for (const snapshot of [null, "invalid", []] as const) {
      const error = ColibriError.unexpected({ cause: new Error("failure") });
      error.toJSON = () => snapshot as never;
      assertEquals(serializeBuildVerificationError(error).code, "GEN_000");
    }
    const throwing = ColibriError.unexpected({ cause: 1n });
    throwing.toJSON = () => {
      throw new Error("serialization failed");
    };
    const serialized = serializeBuildVerificationError(throwing);
    assertEquals(serialized.code, "GEN_000");
    assertEquals(
      (serialized.meta as Record<string, unknown>).cause,
      { type: "bigint", value: "1" },
    );
  });
});
