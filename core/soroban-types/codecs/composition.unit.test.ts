import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import {
  SorobanBytes,
  SorobanError,
  SorobanString,
  SorobanSymbol,
  SorobanU32,
} from "@/soroban-types/values/primitives.ts";
import {
  SorobanMap,
  SorobanOption,
  SorobanResult,
  SorobanTuple,
  SorobanVec,
} from "@/soroban-types/values/collections.ts";
import {
  createSorobanType,
  sorobanTypeFromSpec,
} from "@/soroban-types/codecs/custom.ts";
import {
  createSorobanFactory,
  createSorobanUnion,
} from "@/soroban-types/codecs/factories.ts";
import { SorobanValueError } from "@/soroban-types/error.ts";
import type { SorobanValue } from "@/soroban-types/values/value.ts";
import {
  func,
  option,
  struct,
  udt,
  union,
  valueSpec,
} from "colibri-internal/tests/soroban-values-fixtures.ts";

describe("Soroban composed and custom values", () => {
  it("accepts prototype-free records with the same validation and encoding as ordinary structs", () => {
    const spec = new Spec([
      struct("Counter", { count: xdr.ScSpecTypeDef.scSpecTypeU32() }),
    ]);
    const type = createSorobanType<{ count: number }>(spec, "Counter");
    const record = Object.assign(Object.create(null), { count: 7 });
    assertEquals(type.from(record).value, { count: 7 });
    assertEquals(
      type.from(record).toXdr("base64"),
      type.from({ count: 7 }).toXdr("base64"),
    );
  });
  it("validates nested vectors/maps/options/tuples including empty containers", () => {
    const vector = new SorobanVec([1, new SorobanU32(2)], SorobanU32.type);
    assertEquals(vector.value, [1, 2]);
    assertEquals(new SorobanVec([], SorobanU32.type).value, []);
    const map = new SorobanMap(
      [[new SorobanSymbol("role"), vector]],
      SorobanSymbol.type,
      SorobanVec.type(SorobanU32.type),
    );
    assertEquals(map.value, [["role", [1, 2]]]);
    assertEquals(
      new SorobanMap(new Map(), SorobanSymbol.type, SorobanU32.type).value,
      [],
    );
    assertEquals(
      new SorobanOption(new SorobanU32(7), SorobanU32.type).value,
      7,
    );
    assertEquals(new SorobanOption(undefined, SorobanU32.type).value, null);
    assertEquals(SorobanOption.type(SorobanU32.type).from(7).value, 7);
    const tuple = new SorobanTuple(
      ["role", new SorobanU32(7)],
      [SorobanSymbol.type, SorobanU32.type] as const,
    );
    const typed: [string, number] = tuple.value;
    assertEquals(typed, ["role", 7]);
    assertThrows(
      () => SorobanTuple.type([SorobanU32.type]).encodeUnknown([]),
      SorobanValueError,
    );
    assertThrows(
      () =>
        SorobanVec.type(SorobanU32.type).encodeUnknown([
          new SorobanString("7"),
        ]),
      SorobanValueError,
    );
    assertThrows(
      () => SorobanVec.type(SorobanU32.type).fromScVal(xdr.ScVal.scvVec(null)),
      SorobanValueError,
    );
    assertThrows(
      () =>
        SorobanMap.type(SorobanSymbol.type, SorobanU32.type).encodeUnknown([[
          "a",
          1,
        ], ["a", 2]]),
      SorobanValueError,
    );
    assertThrows(
      () =>
        SorobanMap.type(SorobanSymbol.type, SorobanU32.type).encodeUnknown([[
          "a",
        ]]),
      SorobanValueError,
    );
    assertThrows(
      () =>
        SorobanMap.type(SorobanSymbol.type, SorobanU32.type).fromScVal(
          xdr.ScVal.scvMap(null),
        ),
      SorobanValueError,
    );
    const copied = new SorobanVec([new Uint8Array([1])], SorobanBytes.type);
    copied.value[0][0] = 99;
    assertEquals(copied.value[0][0], 1);
  });
  it("represents Result using its actual untagged Ok and ScError ABI", () => {
    const type = SorobanResult.type(SorobanU32.type, SorobanError.type);
    assertEquals(
      type.from({ ok: 7 }).toXdr("base64"),
      xdr.ScVal.scvU32(7).toXdr("base64"),
    );
    const error = { type: "sceContract", code: 9 } as const;
    assertEquals(type.from({ error }).value, { error });
    const codes = createSorobanType<number>(valueSpec(), "AccessError");
    const result = new SorobanResult({ error: 1 }, SorobanU32.type, codes);
    assertEquals(
      result.toXdr("base64"),
      xdr.ScVal.scvError(xdr.ScError.sceContract(1)).toXdr("base64"),
    );
    assertEquals(result.value, { error: 1 });
    assertEquals(new SorobanVec([{ ok: 7 }, { error }], type).value, [
      { ok: 7 },
      { error },
    ]);
    assertThrows(() => type.encodeUnknown({ ok: 7, error }), SorobanValueError);
    assertThrows(
      () =>
        SorobanResult.type(SorobanError.type, SorobanError.type).from({
          ok: error,
        }),
      SorobanValueError,
    );
    assertThrows(
      () =>
        SorobanResult.type(SorobanU32.type, codes).fromScVal(
          xdr.ScVal.scvError(
            xdr.ScError.sceAuth(xdr.ScErrorCode.scecInvalidInput),
          ),
        ),
      SorobanValueError,
    );
  });
  it("generates custom values with exact tags, fields and native SDK encoding", () => {
    type Key = { tag: "ExistingRoles" } | {
      tag: "RoleIndexToAccount";
      values: [string, number];
    } | { tag: "EmptyTuple"; values: [] };
    type KeyInput = { tag: "ExistingRoles" } | {
      tag: "RoleIndexToAccount";
      values: [string | SorobanSymbol, number | SorobanU32];
    } | { tag: "EmptyTuple"; values: [] };
    const spec = valueSpec();
    const key = createSorobanUnion<KeyInput, Key>(() => spec, "RbacStorage");
    assertEquals(key.ExistingRoles().value, { tag: "ExistingRoles" });
    assertEquals(key.EmptyTuple().value, { tag: "EmptyTuple", values: [] });
    const indexed = key.RoleIndexToAccount(
      new SorobanSymbol("ADMIN"),
      new SorobanU32(7),
    );
    assertEquals(indexed.value, {
      tag: "RoleIndexToAccount",
      values: ["ADMIN", 7],
    });
    assertEquals(
      indexed.toXdr("base64"),
      spec.nativeToScVal(indexed.value, udt("RbacStorage")).toXdr("base64"),
    );
    assertEquals(key.fromScVal(indexed.toScVal()).value, indexed.value);
    assertEquals(key.fromXdr(indexed.toXdr("base64")).value, indexed.value);
    const config = createSorobanFactory<unknown>(() => spec, "Config");
    const configured = config.from({
      role: new SorobanSymbol("ADMIN"),
      count: new SorobanU32(7),
      key: indexed,
    });
    assertEquals(
      configured.toXdr("base64"),
      spec.nativeToScVal(configured.value, udt("Config")).toXdr("base64"),
    );
    assertEquals(
      createSorobanType(spec, "Pair").from([
        new SorobanSymbol("ADMIN"),
        new SorobanU32(7),
      ]).value,
      ["ADMIN", 7],
    );
    assertThrows(
      () => config.from({ role: "ADMIN", count: 7 }),
      SorobanValueError,
    );
    assertThrows(
      () => config.from({ role: "ADMIN", count: 7, key: indexed, extra: true }),
      SorobanValueError,
    );
    assertThrows(
      () => key.from({ tag: "Missing" } as unknown as KeyInput),
      SorobanValueError,
    );
    assertThrows(
      () =>
        key.from({ tag: "ExistingRoles", values: [7] } as unknown as KeyInput),
      SorobanValueError,
    );
    assertThrows(() => key.fromScVal(xdr.ScVal.scvVec([])), SorobanValueError);
    assertThrows(
      () =>
        key.fromScVal(
          xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("ExistingRoles"),
            xdr.ScVal.scvU32(7),
          ]),
        ),
      SorobanValueError,
    );
  });
  it("checks dependent schema identity and snapshots spec definitions", () => {
    const spec = valueSpec();
    const original = createSorobanType(spec, "Config");
    const key = createSorobanType(spec, "RbacStorage").from({
      tag: "RoleIndexToAccount",
      values: ["ADMIN", 7],
    });
    const value = original.from({ role: "ADMIN", count: 7, key });
    const different = new Spec(
      spec.entries.map((entry) =>
        entry.type === "scSpecEntryUdtUnionV0"
          ? union("RbacStorage", {
            RoleIndexToAccount: [
              xdr.ScSpecTypeDef.scSpecTypeString(),
              xdr.ScSpecTypeDef.scSpecTypeU32(),
            ],
          })
          : entry
      ),
    );
    assertThrows(
      () => createSorobanType(different, "Config").encodeUnknown(value),
      SorobanValueError,
    );
    const equivalent = new Spec([...spec.entries, func("unrelated", {})]);
    assertEquals(
      createSorobanType(equivalent, "Config").encodeUnknown(value).toXdr(
        "base64",
      ),
      value.toXdr("base64"),
    );
    spec.entries.splice(0, spec.entries.length);
    assertEquals(original.from(value).value, value.value);
    assertThrows(() => createSorobanType(spec, "Missing"), SorobanValueError);
    const factorySpec = new Spec([
      struct("Lazy", { count: xdr.ScSpecTypeDef.scSpecTypeU32() }),
    ]);
    const factory = createSorobanFactory<{ count: number }>(
      () => factorySpec,
      "Lazy",
    );
    assertEquals(factory.type.name, "Lazy");
    factory.from({ count: 7 });
    factorySpec.entries.splice(0, 1);
    assertEquals(factory.from({ count: 8 }).value, { count: 8 });
  });
  it("includes dependencies inside every container even when a value is empty", () => {
    const leaf = udt("Leaf");
    const originalLeaf = struct("Leaf", {
      x: xdr.ScSpecTypeDef.scSpecTypeU32(),
    });
    const changedLeaf = struct("Leaf", {
      x: xdr.ScSpecTypeDef.scSpecTypeString(),
    });
    const variants: Array<[xdr.ScSpecTypeDef, unknown]> = [
      [option(leaf), null],
      [
        xdr.ScSpecTypeDef.scSpecTypeVec(
          new xdr.ScSpecTypeVec({ elementType: leaf }),
        ),
        [],
      ],
      [
        xdr.ScSpecTypeDef.scSpecTypeMap(
          new xdr.ScSpecTypeMap({ keyType: leaf, valueType: leaf }),
        ),
        [],
      ],
      [
        xdr.ScSpecTypeDef.scSpecTypeTuple(
          new xdr.ScSpecTypeTuple({ valueTypes: [leaf] }),
        ),
        [{ x: 1 }],
      ],
      [
        xdr.ScSpecTypeDef.scSpecTypeResult(
          new xdr.ScSpecTypeResult({
            okType: leaf,
            errorType: udt("AccessError"),
          }),
        ),
        { ok: { x: 1 } },
      ],
    ];
    const errors = valueSpec().entries.find((entry) =>
      entry.type === "scSpecEntryUdtErrorEnumV0"
    )!;
    for (const [descriptor, value] of variants) {
      const envelope = struct("Envelope", { value: descriptor });
      const original = createSorobanType(
        new Spec([originalLeaf, errors, envelope]),
        "Envelope",
      );
      const changed = createSorobanType(
        new Spec([changedLeaf, errors, envelope]),
        "Envelope",
      );
      const wrapped = original.from({ value });
      assertEquals(original.fromScVal(wrapped.toScVal()).value, { value });
      assertThrows(() => changed.encodeUnknown(wrapped), SorobanValueError);
    }
  });
  it("handles recursive types and rejects malformed decoded shapes", () => {
    const node = createSorobanType(valueSpec(), "Node");
    assertEquals(
      node.from({ value: 1, next: { value: 2, next: null } }).value,
      { value: 1, next: { value: 2, next: null } },
    );
    const type = createSorobanType(valueSpec(), "Config");
    assertThrows(() => type.fromScVal(xdr.ScVal.scvMap([])), SorobanValueError);
    assertThrows(
      () => type.fromScVal(xdr.ScVal.scvMap(null)),
      SorobanValueError,
    );
    const duplicate = new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("role"),
      val: xdr.ScVal.scvSymbol("ADMIN"),
    });
    assertThrows(
      () => type.fromScVal(xdr.ScVal.scvMap([duplicate, duplicate])),
      SorobanValueError,
    );
    assertThrows(
      () =>
        createSorobanType(
          new Spec([
            struct("BadTuple", { "1": xdr.ScSpecTypeDef.scSpecTypeU32() }),
          ]),
          "BadTuple",
        ).from([7]),
      SorobanValueError,
    );
    const protoSpec = new Spec([
      struct(
        "Safe",
        Object.fromEntries([["__proto__", xdr.ScSpecTypeDef.scSpecTypeU32()]]),
      ),
    ]);
    const decoded =
      createSorobanType<Record<string, number>>(protoSpec, "Safe").from(
        Object.fromEntries([["__proto__", 7]]),
      ).value;
    assertEquals(Object.getPrototypeOf(decoded), Object.prototype);
    assertEquals(
      Object.getOwnPropertyDescriptor(decoded, "__proto__")?.value,
      7,
    );
    assertThrows(
      () => createSorobanUnion(() => valueSpec(), "Config"),
      SorobanValueError,
    );
    assertThrows(
      () =>
        createSorobanUnion(
          () => new Spec([union("Conflict", { from: null })]),
          "Conflict",
        ),
      SorobanValueError,
    );
  });
  it("dispatches every supported spec discriminant explicitly", () => {
    const simple = [
      "Val",
      "Bool",
      "Void",
      "Error",
      "U32",
      "I32",
      "U64",
      "I64",
      "U128",
      "I128",
      "U256",
      "I256",
      "Timepoint",
      "Duration",
      "Bytes",
      "String",
      "Symbol",
      "Address",
      "MuxedAddress",
    ] as const;
    const u32 = xdr.ScSpecTypeDef.scSpecTypeU32();
    const types: xdr.ScSpecTypeDef[] = simple.map((name) =>
      xdr.ScSpecTypeDef[`scSpecType${name}`]()
    );
    types.push(
      option(u32),
      xdr.ScSpecTypeDef.scSpecTypeVec(
        new xdr.ScSpecTypeVec({ elementType: u32 }),
      ),
      xdr.ScSpecTypeDef.scSpecTypeMap(
        new xdr.ScSpecTypeMap({ keyType: u32, valueType: u32 }),
      ),
      xdr.ScSpecTypeDef.scSpecTypeTuple(
        new xdr.ScSpecTypeTuple({ valueTypes: [u32] }),
      ),
      xdr.ScSpecTypeDef.scSpecTypeBytesN(new xdr.ScSpecTypeBytesN({ n: 32 })),
      xdr.ScSpecTypeDef.scSpecTypeResult(
        new xdr.ScSpecTypeResult({
          okType: u32,
          errorType: udt("AccessError"),
        }),
      ),
      udt("Config"),
    );
    assertEquals(
      types.map((type) => type.type).sort(),
      Object.values(xdr.ScSpecType).filter((value) =>
        value instanceof xdr.ScSpecType
      ).map((value) => value.name).sort(),
    );
    for (const type of types) sorobanTypeFromSpec(valueSpec(), type);
    assertThrows(
      () =>
        sorobanTypeFromSpec(
          valueSpec(),
          { type: "futureSpecType" } as unknown as xdr.ScSpecTypeDef,
        ),
      SorobanValueError,
    );
    const decoded: SorobanValue<number> = SorobanU32.type.from(7);
    assertEquals(decoded.value, 7);
  });
});
