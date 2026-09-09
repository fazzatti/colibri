import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as xdr from "stellar-sdk/xdr";
import { Spec } from "stellar-sdk/contract";
import {
  SorobanI256,
  SorobanString,
  SorobanSymbol,
  SorobanU32,
  SorobanVal,
} from "@/values/primitives.ts";
import {
  SorobanMap,
  SorobanResult,
  SorobanTuple,
  SorobanVec,
} from "@/values/containers.ts";
import {
  canonicalMap,
  compareScVals,
  requireOrderedMap,
} from "@/values/ordering.ts";
import { contractValType } from "@/values/generic.ts";
import { createSorobanUnion } from "@/values/factories.ts";
import { SorobanValueError } from "@/values/error.ts";
import { SorobanType } from "@/values/value.ts";
import { union } from "colibri-internal/tests/soroban-values-fixtures.ts";

describe("Soroban schema validation", () => {
  it("orders map keys by signed numeric and lexicographic value, without length prefixes", () => {
    const input = [1n, -(2n ** 255n), 0n, -1n, 2n ** 200n];
    const values = new SorobanMap(
      input.map((key) => [key, 0]),
      SorobanI256.type,
      SorobanU32.type,
    );
    assertEquals(values.value.map(([key]) => key), [
      -(2n ** 255n),
      -1n,
      0n,
      1n,
      2n ** 200n,
    ]);
    const strings = new SorobanMap(
      [["b", 1], ["aa", 2], ["a", 3], ["é", 4]],
      SorobanString.type,
      SorobanU32.type,
    );
    assertEquals(strings.value.map(([key]) => key), ["a", "aa", "b", "é"]);
    const vector = (items: number[]) =>
      new SorobanVec(items, SorobanU32.type).toScVal();
    assertEquals(compareScVals(vector([1, 2]), vector([1, 2])), 0);
    assertEquals(Math.sign(compareScVals(vector([1, 2]), vector([2]))), -1);
    assertEquals(Math.sign(compareScVals(vector([1]), vector([1, 0]))), -1);
    assertEquals(
      Math.sign(compareScVals(xdr.ScVal.scvVoid(), xdr.ScVal.scvU32(0))),
      -1,
    );
    const map = strings.toScVal();
    assert(map.type === "scvMap");
    const entries = map.map!;
    assertThrows(
      () => requireOrderedMap([...entries].reverse()),
      SorobanValueError,
    );
    assertThrows(
      () => canonicalMap([entries[0], entries[0]]),
      SorobanValueError,
    );
    assertEquals(canonicalMap([...entries].reverse()), entries);
    assertThrows(
      () =>
        SorobanMap.type(SorobanString.type, SorobanU32.type).fromScVal(
          xdr.ScVal.scvMap([...entries].reverse()),
        ),
      SorobanValueError,
    );
  });
  it("rejects system values, invalid nested symbols, null maps and cyclic generic arguments", () => {
    const type = contractValType();
    for (
      const invalid of [
        xdr.ScVal.scvLedgerKeyContractInstance(),
        xdr.ScVal.scvMap(null),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("has space")]),
      ]
    ) {
      assertThrows(() => type.from(new SorobanVal(invalid)), SorobanValueError);
    }
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    assertThrows(() => type.from(cyclic), SorobanValueError);
    const raw = { role: new SorobanSymbol("ADMIN"), number: new SorobanU32(7) };
    const encoded = type.from(raw);
    assertEquals(
      type.fromScVal(encoded.toScVal()).toXdr("hex"),
      encoded.toXdr("hex"),
    );
    assertEquals(
      type.from(new Map([[new SorobanSymbol("ADMIN"), 7]])).toScVal().type,
      "scvMap",
    );
    const shared = [new SorobanSymbol("ADMIN")];
    const vector = type.from([shared, shared]).toScVal();
    assert(vector.type === "scvVec");
    assertEquals(vector.vec!.length, 2);
  });
  it("reports malformed codecs, XDR and composed values as Colibri value errors", () => {
    assertThrows(() => SorobanU32.type.fromXdr("invalid"), SorobanValueError);
    assertThrows(
      () => SorobanU32.type.fromXdr(new Uint8Array([1])),
      SorobanValueError,
    );
    const bad = new SorobanType(
      "bad",
      "bad",
      () => xdr.ScVal.scvU32(-1),
      () => 1,
    );
    assertThrows(() => bad.from(1), SorobanValueError);
    assertThrows(
      () => SorobanVec.type(SorobanU32.type).encodeUnknown({}),
      SorobanValueError,
    );
    assertThrows(
      () =>
        SorobanTuple.type([SorobanU32.type]).fromScVal(xdr.ScVal.scvVec([])),
      SorobanValueError,
    );
    assertThrows(
      () => SorobanMap.type(SorobanU32.type, SorobanU32.type).encodeUnknown({}),
      SorobanValueError,
    );
    const result = SorobanResult.type(SorobanU32.type, SorobanU32.type);
    assertThrows(
      () => result.encodeUnknown({ ok: 1, error: 1 }),
      SorobanValueError,
    );
    assertThrows(
      () =>
        result.fromScVal(
          xdr.ScVal.scvError(
            xdr.ScError.sceValue(xdr.ScErrorCode.scecInvalidInput),
          ),
        ),
      SorobanValueError,
    );
  });
  it("checks factory definitions and exact variant arity", () => {
    assertThrows(
      () => createSorobanUnion(() => ({ entries: [] }), "Missing"),
      SorobanValueError,
    );
    const invalid = new Spec([union("Bad", { from: null })]);
    assertThrows(
      () => createSorobanUnion(() => invalid, "Bad"),
      SorobanValueError,
    );
    const spec = new Spec([
      union("Choice", {
        None: null,
        Some: [xdr.ScSpecTypeDef.scSpecTypeU32()],
      }),
    ]);
    const factory = createSorobanUnion<
      { tag: "None" } | { tag: "Some"; values: [number] }
    >(() => spec, "Choice");
    assertThrows(
      () => Reflect.apply(factory.None, factory, [1]),
      SorobanValueError,
    );
    assertThrows(
      () => Reflect.apply(factory.Some, factory, []),
      SorobanValueError,
    );
    assertEquals(factory.Some(7).value, { tag: "Some", values: [7] });
    assertEquals(factory.fromScVal(factory.None().toScVal()).value, {
      tag: "None",
    });
  });
});
