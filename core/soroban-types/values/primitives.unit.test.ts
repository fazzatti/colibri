import { assertEquals, assertNotStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, StrKey, xdr, XdrLargeInt } from "stellar-sdk";
import * as V from "@/soroban-types/values/primitives.ts";
import {
  type SorobanValue,
  toSorobanScVal,
} from "@/soroban-types/values/value.ts";
import { Code, SorobanValueError } from "@/soroban-types/error.ts";
import * as S from "@/soroban-types/values/system.ts";
import { sorobanTypeFromSpec } from "@/soroban-types/codecs/custom.ts";

describe("validated Soroban primitives", () => {
  for (const signed of [false, true]) {
    for (const width of [32, 64, 128, 256]) {
      const name = `${signed ? "I" : "U"}${width}` as "I32";
      const Value = V[`Soroban${name}`] as unknown as new (
        value: unknown,
      ) => SorobanValue<unknown>;
      const min = signed ? -(1n << BigInt(width - 1)) : 0n;
      const max = (1n << BigInt(width - (signed ? 1 : 0))) - 1n;
      const native = (value: bigint): number | bigint =>
        width === 32 ? Number(value) : value;
      it(`validates the full ${name} range and preserves native XDR`, () => {
        for (const value of [min, 0n, max]) {
          const wrapped = new Value(native(value));
          const expected = width === 32
            ? signed
              ? xdr.ScVal.scvI32(Number(value))
              : xdr.ScVal.scvU32(Number(value))
            : new XdrLargeInt(name.toLowerCase() as "u64", value).toScVal();
          assertEquals(wrapped.value, native(value));
          assertEquals(wrapped.toXdr("base64"), expected.toXdr("base64"));
          assertEquals(
            wrapped.codec.fromXdr(wrapped.toXdr()).value,
            native(value),
          );
          assertEquals(
            wrapped.codec.fromXdr(wrapped.toXdr("hex"), "hex").value,
            native(value),
          );
        }
        for (
          const bad of [
            native(min - 1n),
            native(max + 1n),
            1.5,
            NaN,
            Infinity,
            "1",
            null,
          ]
        ) {
          assertThrows(() => new Value(bad), SorobanValueError);
        }
        assertThrows(
          () => new Value(native(1n)).codec.fromScVal(xdr.ScVal.scvBool(true)),
          SorobanValueError,
        );
      });
    }
  }
  it("keeps timepoint and duration distinct from u64 and each other", () => {
    for (const Type of [V.SorobanTimepoint, V.SorobanDuration]) {
      assertEquals(new Type(0n).value, 0n);
      assertEquals(new Type((1n << 64n) - 1n).value, (1n << 64n) - 1n);
      assertThrows(() => new Type(-1n), SorobanValueError);
      assertThrows(() => new Type(1n << 64n), SorobanValueError);
      assertThrows(
        () => Type.type.encodeUnknown(new V.SorobanU64(1n)),
        SorobanValueError,
      );
    }
    assertEquals(new V.SorobanTimepoint(1n).toScVal().type, "scvTimepoint");
    assertEquals(new V.SorobanDuration(1n).toScVal().type, "scvDuration");
    assertThrows(
      () => V.SorobanDuration.type.encodeUnknown(new V.SorobanTimepoint(1n)),
      SorobanValueError,
    );
  });
  it("validates symbols, text, booleans and void without coercion", () => {
    for (const value of ["", "A_b09", "x".repeat(32)]) {
      assertEquals(new V.SorobanSymbol(value).value, value);
    }
    for (const value of ["x".repeat(33), "ADMIN!", "ação", "\n", "a b"]) {
      assertThrows(() => new V.SorobanSymbol(value), SorobanValueError);
    }
    assertEquals(new V.SorobanString("ação 🐦").value, "ação 🐦");
    assertThrows(() => new V.SorobanString("\ud800"), SorobanValueError);
    const invalidUtf8 = Uint8Array.of(0xff, 0xfe);
    const binaryString = new V.SorobanString(invalidUtf8);
    assertEquals(
      binaryString.value,
      xdr.ScVal.scvString(invalidUtf8).str.toString(),
    );
    assertEquals(
      binaryString.toXdr("base64"),
      xdr.ScVal.scvString(invalidUtf8).toXdr("base64"),
    );
    assertEquals(new V.SorobanString("\ufefftext").value, "\ufefftext");
    assertEquals(new V.SorobanBool(false).value, false);
    assertEquals(new V.SorobanVoid(undefined).value, null);
    assertEquals(new V.SorobanVoid(null).value, null);
    assertThrows(() => V.SorobanBool.type.encodeUnknown(1), SorobanValueError);
    assertThrows(
      () => V.SorobanVoid.type.encodeUnknown(false),
      SorobanValueError,
    );
    const error = assertThrows(
      () => V.SorobanString.type.encodeUnknown(new V.SorobanSymbol("ADMIN")),
      SorobanValueError,
    );
    assertEquals(error.code, Code.TYPE_MISMATCH);
    assertEquals(error.meta?.data, {
      type: "string",
      reason: "received symbol",
    });
    assertEquals(
      V.SorobanSymbol.fromScVal(new V.SorobanSymbol("ADMIN").toScVal()).value,
      "ADMIN",
    );
  });
  it("snapshots mutable input, output, serialized bytes and native XDR", () => {
    const source = Uint8Array.of(1, 2, 3);
    const value = new V.SorobanBytes(source);
    source[0] = 99;
    value.value[1] = 99;
    value.toXdr().fill(0);
    const scv = value.toScVal();
    if (scv.type === "scvBytes") scv.bytes.toBytes()[2] = 99;
    assertEquals(value.value, Uint8Array.of(1, 2, 3));
    assertNotStrictEquals(value.value, value.value);
    const decoded = V.SorobanBytes.type.fromScVal(value.toScVal());
    assertThrows(() => decoded.codec.from("invalid"), SorobanValueError);
    assertEquals(decoded.value, value.value);
    assertThrows(
      () => V.SorobanBytes.type.fromXdr("invalid"),
      SorobanValueError,
    );
    assertEquals(
      V.SorobanBytes.type.fromXdr(value.toXdr("base64")).value,
      value.value,
    );
    assertEquals(V.SorobanBytes.type.from(value).value, value.value);
  });
  it("enforces fixed byte lengths in both directions", () => {
    assertEquals(new V.SorobanBytesN(new Uint8Array(), 0).value.length, 0);
    assertEquals(new V.SorobanBytesN(new Uint8Array(32), 32).value.length, 32);
    assertThrows(
      () => new V.SorobanBytesN(new Uint8Array(31), 32),
      SorobanValueError,
    );
    const fixed = new V.SorobanBytesN(new Uint8Array(32), 32);
    const length: 32 = fixed.value.length;
    assertEquals(length, 32);
    assertEquals(V.SorobanBytes.type.from(fixed).value.length, 32);
    assertEquals(
      V.SorobanBytesN.type(32).from(new V.SorobanBytes(new Uint8Array(32)))
        .value.length,
      32,
    );
    for (const length of [-1, 1.5, 2 ** 32]) {
      assertThrows(() => V.SorobanBytesN.type(length), SorobanValueError);
    }
    assertThrows(
      () =>
        V.SorobanBytesN.type(32).fromScVal(
          xdr.ScVal.scvBytes(new Uint8Array(31)),
        ),
      SorobanValueError,
    );
    assertThrows(
      () =>
        V.SorobanBytesN.type(32).encodeUnknown(
          new V.SorobanBytesN(new Uint8Array(31), 31),
        ),
      SorobanValueError,
    );
  });
  it("validates address kinds and preserves muxed ids", () => {
    const account = StrKey.encodeEd25519PublicKey(new Uint8Array(32));
    const contract = StrKey.encodeContract(new Uint8Array(32));
    const muxed = StrKey.encodeMed25519PublicKey(
      Uint8Array.from([...new Uint8Array(32), 0, 0, 0, 0, 0, 0, 0, 7]),
    );
    for (const address of [account, contract]) {
      assertEquals(new V.SorobanAddress(address).value, address);
      assertEquals(new V.SorobanMuxedAddress(address).value, address);
      assertEquals(
        new V.SorobanMuxedAddress(new V.SorobanAddress(address)).value,
        address,
      );
    }
    const value = new V.SorobanMuxedAddress(muxed);
    assertEquals(value.value, muxed);
    assertEquals(
      value.toXdr("base64"),
      new Address(muxed).toScVal().toXdr("base64"),
    );
    assertThrows(() => new V.SorobanAddress(muxed), SorobanValueError);
    assertThrows(
      () => V.SorobanAddress.type.fromScVal(value.toScVal()),
      SorobanValueError,
    );
    assertThrows(
      () => new V.SorobanAddress(account.slice(0, -1) + "X"),
      SorobanValueError,
    );
    for (
      const address of [
        StrKey.encodeLiquidityPool(new Uint8Array(32)),
        StrKey.encodeClaimableBalance(new Uint8Array(33)),
      ]
    ) {
      assertThrows(() => new V.SorobanAddress(address), SorobanValueError);
      assertThrows(() => new V.SorobanMuxedAddress(address), SorobanValueError);
      assertEquals(
        new V.SorobanVal(new Address(address).toScVal()).value.toXdr("base64"),
        new Address(address).toScVal().toXdr("base64"),
      );
    }
  });
  it("round-trips every contract/host error discriminant", () => {
    for (let type = 0; type <= 9; type++) {
      const wire = type === 0
        ? xdr.ScError.sceContract(0xffff_ffff)
        : xdr.ScError.fromXdrObject({ type, code: 0 } as xdr.ScErrorWire);
      const expected = xdr.ScVal.scvError(wire);
      const decoded = V.SorobanError.type.fromScVal(expected);
      assertEquals(
        new V.SorobanError(decoded.value).toXdr("base64"),
        expected.toXdr("base64"),
      );
    }
    for (
      const bad of [
        { type: "sceContract", code: -1 },
        { type: "sceAuth", code: 99 },
        { type: "missing", code: 1 },
        null,
      ]
    ) {
      assertThrows(
        () => V.SorobanError.type.encodeUnknown(bad),
        SorobanValueError,
      );
    }
  });
  it("preserves all supported ScVal wire variants, including complete system payloads", () => {
    const system = [
      new S.SorobanContractInstance(
        new xdr.ScContractInstance({
          executable: xdr.ContractExecutable.contractExecutableWasm(
            new Uint8Array(32),
          ),
          storage: [
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("count"),
              val: xdr.ScVal.scvU32(7),
            }),
          ],
        }),
      ),
      new S.SorobanLedgerKeyContractInstance(),
      new S.SorobanLedgerKeyNonce(-7n),
      new S.SorobanExecutableTag(Uint8Array.of(0xff)),
    ];
    const wrappers = [
      new V.SorobanBool(true),
      new V.SorobanVoid(null),
      new V.SorobanError({ type: "sceContract", code: 7 }),
      new V.SorobanU32(1),
      new V.SorobanI32(-1),
      new V.SorobanU64(1n),
      new V.SorobanI64(-1n),
      new V.SorobanU128(1n),
      new V.SorobanI128(-1n),
      new V.SorobanU256(1n),
      new V.SorobanI256(-1n),
      new V.SorobanTimepoint(1n),
      new V.SorobanDuration(1n),
      new V.SorobanBytes(new Uint8Array()),
      new V.SorobanString("text"),
      new V.SorobanSymbol("symbol"),
      new V.SorobanAddress(StrKey.encodeContract(new Uint8Array(32))),
      ...system,
    ];
    const encoded = wrappers.map((value) => value.toScVal());
    for (
      const value of [
        ...wrappers,
        new V.SorobanMuxedAddress(StrKey.encodeContract(new Uint8Array(32))),
      ]
    ) {
      const wire = value.toScVal();
      const decoded = value.codec.fromScVal(wire);
      assertEquals(decoded.toXdr("base64"), value.toXdr("base64"));
      assertEquals(decoded.value, value.value);
      assertEquals(
        value.codec.encode(decoded).toXdr("base64"),
        value.toXdr("base64"),
      );
      const other = wire.type === "scvBool"
        ? xdr.ScVal.scvVoid()
        : xdr.ScVal.scvBool(false);
      if ("fromScVal" in value.constructor) {
        const Type = value.constructor as unknown as {
          fromScVal(value: xdr.ScVal): SorobanValue<unknown>;
        };
        assertEquals(Type.fromScVal(wire).toXdr("hex"), value.toXdr("hex"));
        assertThrows(() => Type.fromScVal(other), SorobanValueError);
      } else {
        assertThrows(() => value.codec.fromScVal(other), SorobanValueError);
      }
    }
    assertEquals(
      V.SorobanVal.fromScVal(encoded[0]).toXdr("hex"),
      encoded[0].toXdr("hex"),
    );
    assertThrows(
      () => S.SorobanContractInstance.type.encodeUnknown({}),
      SorobanValueError,
    );
    assertThrows(
      () => S.SorobanLedgerKeyContractInstance.type.encodeUnknown(7),
      SorobanValueError,
    );
    assertThrows(
      () => S.SorobanLedgerKeyNonce.type.encodeUnknown(2n ** 63n),
      SorobanValueError,
    );
    assertThrows(
      () => S.SorobanExecutableTag.type.encodeUnknown(7),
      SorobanValueError,
    );
    encoded.push(xdr.ScVal.scvVec([]), xdr.ScVal.scvMap([]));
    const supported = Object.values(xdr.ScValType).filter((value) =>
      value instanceof xdr.ScValType
    ).map((value) => value.name).sort();
    assertEquals(encoded.map((value) => value.type).sort(), supported);
    for (
      const scv of [...encoded, xdr.ScVal.scvVec(null), xdr.ScVal.scvMap(null)]
    ) {
      const value = new V.SorobanVal(scv);
      assertEquals(value.toXdr("base64"), scv.toXdr("base64"));
      assertEquals(value.value.toXdr("base64"), scv.toXdr("base64"));
      assertEquals(toSorobanScVal(value).toXdr("base64"), scv.toXdr("base64"));
      assertEquals(toSorobanScVal(scv), scv);
    }
    assertEquals(new V.SorobanVal(new V.SorobanU32(7)).value.type, "scvU32");
    for (const value of system) {
      assertThrows(
        () =>
          sorobanTypeFromSpec(
            { entries: [] },
            xdr.ScSpecTypeDef.scSpecTypeVal(),
          )
            .encodeUnknown(value),
        SorobanValueError,
      );
    }
  });
});
