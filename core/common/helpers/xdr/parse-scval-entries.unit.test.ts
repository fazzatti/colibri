import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { xdr } from "stellar-sdk";
import { parseScVal, parseScValEntries } from "@/common/helpers/xdr/scval.ts";
import * as ERROR from "@/common/helpers/xdr/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("parseScValEntries", () => {
  it("preserves String and Symbol keys that collapse in the existing decoder", () => {
    const raw = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvString("x"),
        val: xdr.ScVal.scvU32(1),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("x"),
        val: xdr.ScVal.scvU32(2),
      }),
    ]);

    const entries = parseScValEntries(raw);
    assertEquals(entries.map(({ key }) => key.type), [
      "scvString",
      "scvSymbol",
    ]);
    assertEquals(entries.map(({ value }) => parseScVal(value)), [1, 2]);
    assertEquals(parseScVal(raw), { x: 2 });
    assertEquals(
      xdr.ScVal.scvMap(
        entries.map(({ key, value }) =>
          new xdr.ScMapEntry({ key, val: value })
        ),
      ).toXdr(),
      raw.toXdr(),
    );
  });

  it("retains raw key and nested value objects without changing input bytes", () => {
    const key = xdr.ScVal.scvBytes(new Uint8Array([0, 255]));
    const value = xdr.ScVal.scvVec([
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("optional"),
          val: xdr.ScVal.scvVoid(),
        }),
      ]),
    ]);
    const raw = xdr.ScVal.scvMap([new xdr.ScMapEntry({ key, val: value })]);
    const before = raw.toXdr();

    const entries = parseScValEntries(raw);
    assertStrictEquals(entries[0].key, key);
    assertStrictEquals(entries[0].value, value);
    assertEquals(raw.toXdr(), before);
    entries.pop();
    assertEquals(parseScValEntries(raw).length, 1);
    assertEquals(raw.toXdr(), before);
  });

  it("preserves order and duplicates without claiming canonical validation", () => {
    const keys = [
      xdr.ScVal.scvU32(2),
      xdr.ScVal.scvU32(1),
      xdr.ScVal.scvU32(2),
    ];
    const raw = xdr.ScVal.scvMap(
      keys.map((key, i) =>
        new xdr.ScMapEntry({ key, val: xdr.ScVal.scvU32(i) })
      ),
    );

    const entries = parseScValEntries(raw);
    assertEquals(entries.map(({ key }) => parseScVal(key)), [2, 1, 2]);
    assertEquals(entries.map(({ value }) => parseScVal(value)), [0, 1, 2]);
  });

  it("returns empty entries for both empty and null maps", () => {
    assertEquals(parseScValEntries(xdr.ScVal.scvMap([])), []);
    assertEquals(parseScValEntries(xdr.ScVal.scvMap(null)), []);
  });

  it("rejects non-map values with the existing typed XDR conversion error", () => {
    for (
      const raw of [
        xdr.ScVal.scvVoid(),
        xdr.ScVal.scvU32(1),
        xdr.ScVal.scvVec([]),
      ]
    ) {
      const error = assertThrows(
        () => parseScValEntries(raw),
        ERROR.FAILED_TO_PARSE_XDR,
      );
      assertEquals(error.code, ERROR.Code.FAILED_TO_PARSE_XDR);
      assertEquals(error.meta.data.value, {
        valueType: raw.type,
        xdrTypeName: "scvMap",
      });
    }
  });
});
