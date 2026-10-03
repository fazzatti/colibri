import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { nativeToScVal, xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import {
  func,
  option,
  struct,
  udt,
  union,
} from "colibri-internal/tests/soroban-values-fixtures.ts";
import {
  decodeSorobanResult,
  encodeSorobanArguments,
} from "@/contract/encoding/index.ts";
import { createSorobanType } from "@/soroban-types/codecs/custom.ts";
import * as ERROR from "@/soroban-types/error.ts";
import {
  SorobanSymbol,
  SorobanU32,
  SorobanVal,
} from "@/soroban-types/values/primitives.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const u32 = xdr.ScSpecTypeDef.scSpecTypeU32();
const state = udt("State");
const map = xdr.ScSpecTypeDef.scSpecTypeMap(
  new xdr.ScSpecTypeMap({ keyType: u32, valueType: state }),
);
const record = (entries: [string, xdr.ScVal][]) =>
  xdr.ScVal.scvMap(
    entries.map(([name, val]) =>
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(name), val })
    ),
  );
const spec = new Spec([
  struct("State", { a: option(u32), b: u32, c: option(u32) }),
  union("Envelope", { State: [state] }),
  func("state", { value: state }, [state]),
  func("map", { value: map }, [map]),
  func("optional", {}, [option(state)]),
  func("union", {}, [udt("Envelope")]),
  func("result", {}, [
    xdr.ScSpecTypeDef.scSpecTypeResult(
      new xdr.ScSpecTypeResult({ okType: state, errorType: u32 }),
    ),
  ]),
]);

describe("protocol-compatible function codecs", () => {
  it("uses field names and normalizes omitted optional fields", () => {
    assertEquals(
      decodeSorobanResult(spec, "state", record([["b", xdr.ScVal.scvU32(7)]])),
      { a: null, b: 7, c: null },
    );
    assertEquals(
      decodeSorobanResult(
        spec,
        "state",
        record([["A", xdr.ScVal.scvU32(99)], ["b", xdr.ScVal.scvU32(7)], [
          "z",
          xdr.ScVal.scvBool(true),
        ]]),
      ),
      { a: null, b: 7, c: null },
    );
  });
  it("rejects missing required fields, wrong arms, duplicate and unordered keys", () => {
    for (
      const raw of [
        record([]),
        record([["b", xdr.ScVal.scvI32(7)]]),
        record([["b", xdr.ScVal.scvU32(7)], ["b", xdr.ScVal.scvU32(8)]]),
        record([["c", xdr.ScVal.scvVoid()], ["b", xdr.ScVal.scvU32(7)]]),
        xdr.ScVal.scvMap(null),
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvString("b"),
            val: xdr.ScVal.scvU32(7),
          }),
        ]),
      ]
    ) assertThrows(() => decodeSorobanResult(spec, "state", raw));
  });
  it("encodes omitted optional properties densely and rejects unknown input keys", () => {
    const expected = record([["a", xdr.ScVal.scvVoid()], [
      "b",
      xdr.ScVal.scvU32(7),
    ], ["c", xdr.ScVal.scvVoid()]]);
    assertEquals(
      encodeSorobanArguments(spec, "state", { value: { b: 7 } })[0].toXdr(),
      expected.toXdr(),
    );
    assertEquals(
      createSorobanType(spec, "State").encodeUnknown({ b: 7 }).toXdr(),
      expected.toXdr(),
    );
    assertThrows(
      () => encodeSorobanArguments(spec, "state", { value: { b: 7, z: 1 } }),
      ERROR.SorobanValueError,
    );
  });
  it("applies name-based decoding inside options, unions, maps and native Ok results", () => {
    const raw = record([["b", xdr.ScVal.scvU32(7)]]);
    const expected = { a: null, b: 7, c: null };
    assertEquals(decodeSorobanResult(spec, "optional", raw), expected);
    assertEquals(
      decodeSorobanResult(
        spec,
        "union",
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("State"), raw]),
      ),
      { tag: "State", values: [expected] },
    );
    const result = decodeSorobanResult(spec, "result", raw) as {
      unwrap(): unknown;
    };
    assertEquals(result.unwrap(), expected);
    assertEquals(
      decodeSorobanResult(
        spec,
        "map",
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: xdr.ScVal.scvU32(1), val: raw }),
        ]),
      ),
      [[1, expected]],
    );
  });
  it("sorts plain typed-map arguments and rejects duplicate encoded keys", () => {
    const input = new Map([[10, { b: 1 }], [9, { b: 2 }]]);
    const encoded = encodeSorobanArguments(spec, "map", { value: input })[0];
    assertEquals(encoded.type, "scvMap");
    if (encoded.type === "scvMap") {
      assertEquals(
        encoded.map!.map(({ key }) => key.type === "scvU32" ? key.u32 : -1),
        [9, 10],
      );
    }
    assertEquals([...input.keys()], [10, 9]);
    assertThrows(
      () =>
        encodeSorobanArguments(spec, "map", {
          value: [[1, { b: 1 }], [1, { b: 2 }]],
        }),
      ERROR.SorobanValueError,
    );
    assertThrows(
      () =>
        encodeSorobanArguments(spec, "map", {
          value: [[1, { b: 1 }], [new SorobanU32(1), { b: 2 }]],
        }),
      ERROR.SorobanValueError,
    );
  });
  it("defaults only void-compatible fields and keeps strict diagnostics available", () => {
    const schema = new Spec([
      struct("Fields", {
        a: option(u32),
        b: u32,
        c: option(u32),
        d: xdr.ScSpecTypeDef.scSpecTypeVoid(),
        e: xdr.ScSpecTypeDef.scSpecTypeVal(),
        f: option(u32),
      }),
      func("fields", {}, [udt("Fields")]),
    ]);
    const raw = record([["b", xdr.ScVal.scvU32(7)]]);
    assertEquals(decodeSorobanResult(schema, "fields", raw), {
      a: null,
      b: 7,
      c: null,
      d: null,
      e: null,
      f: null,
    });
    const strict = createSorobanType(schema, "Fields", {
      structFields: "strict",
    });
    assertThrows(() => strict.decode(raw), ERROR.SorobanValueError);
    assertThrows(
      () =>
        strict.decode(
          record([["b", xdr.ScVal.scvU32(7)], [
            "extra",
            xdr.ScVal.scvBool(true),
          ]]),
        ),
      ERROR.SorobanValueError,
    );
    const proto = new Spec([
      struct("Proto", Object.fromEntries([["__proto__", option(u32)]])),
    ]);
    assertEquals(
      createSorobanType(proto, "Proto").from({}).value,
      Object.fromEntries([["__proto__", null]]),
    );
  });
  it("routes structures nested in vectors and tuples without weakening positional arity", () => {
    const nested = xdr.ScSpecTypeDef.scSpecTypeTuple(
      new xdr.ScSpecTypeTuple({
        valueTypes: [
          xdr.ScSpecTypeDef.scSpecTypeVec(
            new xdr.ScSpecTypeVec({ elementType: state }),
          ),
          option(state),
        ],
      }),
    );
    const schema = new Spec([...spec.entries, func("nested", {}, [nested])]);
    const sparse = record([["b", xdr.ScVal.scvU32(7)]]);
    assertEquals(
      decodeSorobanResult(
        schema,
        "nested",
        xdr.ScVal.scvVec([xdr.ScVal.scvVec([sparse]), sparse]),
      ),
      [[{ a: null, b: 7, c: null }], { a: null, b: 7, c: null }],
    );
    assertThrows(
      () =>
        decodeSorobanResult(
          schema,
          "nested",
          xdr.ScVal.scvVec([xdr.ScVal.scvVec([])]),
        ),
      ERROR.SorobanValueError,
    );
  });
  it("uses host key ordering for signed integers, UTF-8, bytes, nested keys and mixed Val arms", () => {
    const cases: Array<[xdr.ScSpecTypeDef, unknown[], unknown[]]> = [
      [xdr.ScSpecTypeDef.scSpecTypeI128(), [10n, -1n, 9n, -(2n ** 127n)], [
        -(2n ** 127n),
        -1n,
        9n,
        10n,
      ]],
      [xdr.ScSpecTypeDef.scSpecTypeString(), [
        "\u{10000}",
        "\ue000",
        "a\0",
        "a",
        "aa",
      ], ["a", "a\0", "aa", "\ue000", "\u{10000}"]],
      [xdr.ScSpecTypeDef.scSpecTypeBytes(), [
        Uint8Array.of(2),
        Uint8Array.of(1, 1),
        Uint8Array.of(1),
      ], [Uint8Array.of(1), Uint8Array.of(1, 1), Uint8Array.of(2)]],
      [
        xdr.ScSpecTypeDef.scSpecTypeVec(
          new xdr.ScSpecTypeVec({ elementType: u32 }),
        ),
        [[2], [1, 1], [1]],
        [[1], [1, 1], [2]],
      ],
    ];
    for (const [keyType, input, expected] of cases) {
      const type = xdr.ScSpecTypeDef.scSpecTypeMap(
        new xdr.ScSpecTypeMap({ keyType, valueType: u32 }),
      );
      const schema = new Spec([func("keys", { value: type }, [type])]);
      const pairs = input.map((key) => [key, 1]);
      const before = structuredClone(pairs);
      const encoded =
        encodeSorobanArguments(schema, "keys", { value: pairs })[0];
      assertEquals(
        decodeSorobanResult(schema, "keys", encoded),
        expected.map((key) => [key, 1]),
      );
      assertEquals(pairs, before);
    }
    const type = xdr.ScSpecTypeDef.scSpecTypeMap(
      new xdr.ScSpecTypeMap({
        keyType: xdr.ScSpecTypeDef.scSpecTypeVal(),
        valueType: u32,
      }),
    );
    const schema = new Spec([func("mixed", { value: type }, [type])]);
    const encoded = encodeSorobanArguments(schema, "mixed", {
      value: [[new SorobanSymbol("x"), 1], [
        new SorobanVal(nativeToScVal("x")),
        2,
      ]],
    })[0];
    if (encoded.type === "scvMap") {
      assertEquals(encoded.map!.map(({ key }) => key.type), [
        "scvString",
        "scvSymbol",
      ]);
    }
  });
});
