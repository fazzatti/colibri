import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import {
  parseScVal,
  parseScVals,
  getScValTypeName,
  isScValRecord,
  isScValMap,
  asUnion,
} from "@/common//scval/index.ts";
import type {
  ScValParsed,
  ScValRecord,
  ScValMap,
} from "@/common//scval/types.ts";

describe("ScVal Parser", () => {
  describe("parseScVal", () => {
    describe("void", () => {
      it("should parse scvVoid to null", () => {
        const scv = xdr.ScVal.scvVoid();
        const result = parseScVal(scv);

        assertEquals(result, null);
      });
    });

    describe("boolean", () => {
      it("should parse scvBool true", () => {
        const scv = xdr.ScVal.scvBool(true);
        const result = parseScVal(scv);

        assertEquals(result, true);
      });

      it("should parse scvBool false", () => {
        const scv = xdr.ScVal.scvBool(false);
        const result = parseScVal(scv);

        assertEquals(result, false);
      });
    });

    describe("integers - small (number)", () => {
      it("should parse scvU32 to number", () => {
        const scv = xdr.ScVal.scvU32(42);
        const result = parseScVal(scv);

        assertEquals(result, 42);
        assertEquals(typeof result, "number");
      });

      it("should parse scvU32 max value", () => {
        const scv = xdr.ScVal.scvU32(4294967295);
        const result = parseScVal(scv);

        assertEquals(result, 4294967295);
      });

      it("should parse scvI32 positive", () => {
        const scv = xdr.ScVal.scvI32(42);
        const result = parseScVal(scv);

        assertEquals(result, 42);
        assertEquals(typeof result, "number");
      });

      it("should parse scvI32 negative", () => {
        const scv = xdr.ScVal.scvI32(-42);
        const result = parseScVal(scv);

        assertEquals(result, -42);
      });

      it("should parse scvI32 zero", () => {
        const scv = xdr.ScVal.scvI32(0);
        const result = parseScVal(scv);

        assertEquals(result, 0);
      });
    });

    describe("integers - large (bigint)", () => {
      it("should parse scvU64 to bigint", () => {
        const scv = nativeToScVal(BigInt("18446744073709551615"), {
          type: "u64",
        });
        const result = parseScVal(scv);

        assertEquals(result, 18446744073709551615n);
        assertEquals(typeof result, "bigint");
      });

      it("should parse scvI64 positive to bigint", () => {
        const scv = nativeToScVal(BigInt("9223372036854775807"), {
          type: "i64",
        });
        const result = parseScVal(scv);

        assertEquals(result, 9223372036854775807n);
      });

      it("should parse scvI64 negative to bigint", () => {
        const scv = nativeToScVal(BigInt("-9223372036854775808"), {
          type: "i64",
        });
        const result = parseScVal(scv);

        assertEquals(result, -9223372036854775808n);
      });

      it("should parse scvU128 to bigint", () => {
        const scv = nativeToScVal(
          BigInt("340282366920938463463374607431768211455"),
          {
            type: "u128",
          }
        );
        const result = parseScVal(scv);

        assertEquals(result, 340282366920938463463374607431768211455n);
      });

      it("should parse scvI128 to bigint", () => {
        const scv = nativeToScVal(
          BigInt("-170141183460469231731687303715884105728"),
          {
            type: "i128",
          }
        );
        const result = parseScVal(scv);

        assertEquals(result, -170141183460469231731687303715884105728n);
      });

      it("should parse scvU256 to bigint", () => {
        const scv = nativeToScVal(BigInt("12345678901234567890"), {
          type: "u256",
        });
        const result = parseScVal(scv);

        assertEquals(result, 12345678901234567890n);
      });

      it("should parse scvI256 negative to bigint", () => {
        const scv = nativeToScVal(BigInt("-12345678901234567890"), {
          type: "i256",
        });
        const result = parseScVal(scv);

        assertEquals(result, -12345678901234567890n);
      });
    });

    describe("timepoint and duration", () => {
      it("should parse scvTimepoint to bigint", () => {
        const timestamp = BigInt(1700000000);
        const scv = xdr.ScVal.scvTimepoint(new xdr.Uint64(timestamp));
        const result = parseScVal(scv);

        assertEquals(result, timestamp);
        assertEquals(typeof result, "bigint");
      });

      it("should parse scvDuration to bigint", () => {
        const duration = BigInt(3600);
        const scv = xdr.ScVal.scvDuration(new xdr.Uint64(duration));
        const result = parseScVal(scv);

        assertEquals(result, duration);
        assertEquals(typeof result, "bigint");
      });
    });

    describe("strings", () => {
      it("should parse scvSymbol to string", () => {
        const scv = xdr.ScVal.scvSymbol("transfer");
        const result = parseScVal(scv);

        assertEquals(result, "transfer");
        assertEquals(typeof result, "string");
      });

      it("should parse scvSymbol with underscore", () => {
        const scv = xdr.ScVal.scvSymbol("my_event");
        const result = parseScVal(scv);

        assertEquals(result, "my_event");
      });

      it("should parse scvString to string", () => {
        const scv = xdr.ScVal.scvString("Hello, World!");
        const result = parseScVal(scv);

        assertEquals(result, "Hello, World!");
      });

      it("should parse empty scvString", () => {
        const scv = xdr.ScVal.scvString("");
        const result = parseScVal(scv);

        assertEquals(result, "");
      });
    });

    describe("bytes", () => {
      it("should parse scvBytes to Uint8Array", () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5]);
        const scv = xdr.ScVal.scvBytes(Buffer.from(bytes));
        const result = parseScVal(scv);

        assertInstanceOf(result, Uint8Array);
        assertEquals(result, bytes);
      });

      it("should parse empty scvBytes", () => {
        const scv = xdr.ScVal.scvBytes(Buffer.from([]));
        const result = parseScVal(scv);

        assertInstanceOf(result, Uint8Array);
        assertEquals((result as Uint8Array).length, 0);
      });

      it("should parse scvBytes with 32 bytes", () => {
        const bytes = new Uint8Array(32).fill(0xab);
        const scv = xdr.ScVal.scvBytes(Buffer.from(bytes));
        const result = parseScVal(scv);

        assertInstanceOf(result, Uint8Array);
        assertEquals((result as Uint8Array).length, 32);
        assertEquals((result as Uint8Array)[0], 0xab);
      });
    });

    describe("address", () => {
      it("should parse scvAddress account to strkey string", () => {
        const keypair = Keypair.random();
        const address = new Address(keypair.publicKey());
        const scv = address.toScVal();
        const result = parseScVal(scv);

        assertEquals(result, keypair.publicKey());
        assertEquals(typeof result, "string");
      });

      it("should parse scvAddress contract to strkey string", () => {
        const contractId =
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
        const address = new Address(contractId);
        const scv = address.toScVal();
        const result = parseScVal(scv);

        assertEquals(result, contractId);
      });
    });

    describe("vec", () => {
      it("should parse scvVec to array", () => {
        const scv = xdr.ScVal.scvVec([
          xdr.ScVal.scvU32(1),
          xdr.ScVal.scvU32(2),
          xdr.ScVal.scvU32(3),
        ]);
        const result = parseScVal(scv);

        assertEquals(Array.isArray(result), true);
        assertEquals(result, [1, 2, 3]);
      });

      it("should parse empty scvVec", () => {
        const scv = xdr.ScVal.scvVec([]);
        const result = parseScVal(scv);

        assertEquals(Array.isArray(result), true);
        assertEquals(result, []);
      });

      it("should parse scvVec with mixed types", () => {
        const scv = xdr.ScVal.scvVec([
          xdr.ScVal.scvBool(true),
          xdr.ScVal.scvU32(42),
          xdr.ScVal.scvSymbol("test"),
        ]);
        const result = parseScVal(scv);

        assertEquals(result, [true, 42, "test"]);
      });

      it("should parse nested scvVec", () => {
        const scv = xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([xdr.ScVal.scvU32(1), xdr.ScVal.scvU32(2)]),
          xdr.ScVal.scvVec([xdr.ScVal.scvU32(3), xdr.ScVal.scvU32(4)]),
        ]);
        const result = parseScVal(scv);

        assertEquals(result, [
          [1, 2],
          [3, 4],
        ]);
      });

      it("should handle scvVec with null internal value", () => {
        // Create a fake ScVal that returns null for vec()
        const fakeScVal = {
          switch: () => xdr.ScValType.scvVec(),
          vec: () => null,
        } as unknown as xdr.ScVal;

        const result = parseScVal(fakeScVal);
        assertEquals(result, []);
      });
    });

    describe("map with string keys", () => {
      it("should parse scvMap with symbol keys to record", () => {
        const scv = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("name"),
            val: xdr.ScVal.scvString("Alice"),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("age"),
            val: xdr.ScVal.scvU32(30),
          }),
        ]);
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertEquals((result as ScValRecord)["name"], "Alice");
        assertEquals((result as ScValRecord)["age"], 30);
      });

      it("should parse scvMap with string keys to record", () => {
        const scv = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvString("key1"),
            val: xdr.ScVal.scvBool(true),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvString("key2"),
            val: xdr.ScVal.scvBool(false),
          }),
        ]);
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertEquals((result as ScValRecord)["key1"], true);
        assertEquals((result as ScValRecord)["key2"], false);
      });

      it("should parse empty scvMap to empty record", () => {
        const scv = xdr.ScVal.scvMap([]);
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertEquals(Object.keys(result as ScValRecord).length, 0);
      });

      it("should handle scvMap with null internal value", () => {
        // Create a fake ScVal that returns null for map()
        const fakeScVal = {
          switch: () => xdr.ScValType.scvMap(),
          map: () => null,
        } as unknown as xdr.ScVal;

        const result = parseScVal(fakeScVal);
        assertEquals(isScValRecord(result), true);
        assertEquals(Object.keys(result as ScValRecord).length, 0);
      });
    });

    describe("map with non-string keys", () => {
      it("should parse scvMap with integer keys to Map", () => {
        const scv = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvU32(1),
            val: xdr.ScVal.scvString("one"),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvU32(2),
            val: xdr.ScVal.scvString("two"),
          }),
        ]);
        const result = parseScVal(scv);

        assertEquals(isScValMap(result), true);
        assertEquals((result as ScValMap).get(1), "one");
        assertEquals((result as ScValMap).get(2), "two");
      });

      it("should parse scvMap with mixed key types to Map", () => {
        const scv = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvU32(1),
            val: xdr.ScVal.scvString("number key"),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("name"),
            val: xdr.ScVal.scvString("symbol key"),
          }),
        ]);
        const result = parseScVal(scv);

        assertEquals(isScValMap(result), true);
      });
    });

    describe("error", () => {
      it("should parse scvError contract error", () => {
        const scv = xdr.ScVal.scvError(xdr.ScError.sceContract(1234));
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertExists((result as ScValRecord)["type"]);
        assertExists((result as ScValRecord)["code"]);
      });

      it("should parse scvError system error", () => {
        const scv = xdr.ScVal.scvError(
          xdr.ScError.sceWasmVm(xdr.ScErrorCode.scecInvalidInput())
        );
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
      });
    });

    describe("contract instance", () => {
      it("should parse scvContractInstance", () => {
        const scv = xdr.ScVal.scvContractInstance(
          new xdr.ScContractInstance({
            executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
            storage: null,
          })
        );
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertExists((result as ScValRecord)["executable"]);
      });
    });

    describe("ledger key types", () => {
      it("should parse scvLedgerKeyContractInstance", () => {
        const scv = xdr.ScVal.scvLedgerKeyContractInstance();
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertEquals(
          (result as ScValRecord)["ledgerKeyType"],
          "contractInstance"
        );
      });

      it("should parse scvLedgerKeyNonce", () => {
        const scv = xdr.ScVal.scvLedgerKeyNonce(
          new xdr.ScNonceKey({ nonce: new xdr.Int64(12345) })
        );
        const result = parseScVal(scv);

        assertEquals(isScValRecord(result), true);
        assertEquals((result as ScValRecord)["ledgerKeyType"], "nonce");
      });
    });

    describe("unsupported types", () => {
      it("should throw error for unsupported ScVal type", () => {
        // Create a fake ScVal-like object with an unknown type
        const fakeScVal = {
          switch: () => ({ value: 9999, name: "scvUnknown" }),
        } as unknown as xdr.ScVal;

        assertThrows(
          () => parseScVal(fakeScVal),
          Error,
          "Unsupported ScVal type: scvUnknown"
        );
      });
    });
  });

  describe("parseScVals", () => {
    it("should parse array of ScVals", () => {
      const scvs = [
        xdr.ScVal.scvSymbol("transfer"),
        xdr.ScVal.scvU32(100),
        xdr.ScVal.scvBool(true),
      ];
      const result = parseScVals(scvs);

      assertEquals(result, ["transfer", 100, true]);
    });

    it("should parse empty array", () => {
      const result = parseScVals([]);

      assertEquals(result, []);
    });

    it("should parse single element array", () => {
      const result = parseScVals([xdr.ScVal.scvSymbol("event")]);

      assertEquals(result, ["event"]);
    });
  });

  describe("getScValTypeName", () => {
    it("should return 'void' for scvVoid", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvVoid()), "void");
    });

    it("should return 'bool' for scvBool", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvBool(true)), "bool");
    });

    it("should return 'u32' for scvU32", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvU32(1)), "u32");
    });

    it("should return 'i32' for scvI32", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvI32(-1)), "i32");
    });

    it("should return 'u64' for scvU64", () => {
      assertEquals(getScValTypeName(nativeToScVal(1n, { type: "u64" })), "u64");
    });

    it("should return 'i64' for scvI64", () => {
      assertEquals(
        getScValTypeName(nativeToScVal(-1n, { type: "i64" })),
        "i64"
      );
    });

    it("should return 'u128' for scvU128", () => {
      assertEquals(
        getScValTypeName(nativeToScVal(1n, { type: "u128" })),
        "u128"
      );
    });

    it("should return 'i128' for scvI128", () => {
      assertEquals(
        getScValTypeName(nativeToScVal(-1n, { type: "i128" })),
        "i128"
      );
    });

    it("should return 'u256' for scvU256", () => {
      assertEquals(
        getScValTypeName(nativeToScVal(1n, { type: "u256" })),
        "u256"
      );
    });

    it("should return 'i256' for scvI256", () => {
      assertEquals(
        getScValTypeName(nativeToScVal(-1n, { type: "i256" })),
        "i256"
      );
    });

    it("should return 'timepoint' for scvTimepoint", () => {
      assertEquals(
        getScValTypeName(xdr.ScVal.scvTimepoint(new xdr.Uint64(1n))),
        "timepoint"
      );
    });

    it("should return 'duration' for scvDuration", () => {
      assertEquals(
        getScValTypeName(xdr.ScVal.scvDuration(new xdr.Uint64(1n))),
        "duration"
      );
    });

    it("should return 'symbol' for scvSymbol", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvSymbol("test")), "symbol");
    });

    it("should return 'string' for scvString", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvString("test")), "string");
    });

    it("should return 'bytes' for scvBytes", () => {
      assertEquals(
        getScValTypeName(xdr.ScVal.scvBytes(Buffer.from([1, 2, 3]))),
        "bytes"
      );
    });

    it("should return 'address' for scvAddress", () => {
      const address = new Address(Keypair.random().publicKey());
      assertEquals(getScValTypeName(address.toScVal()), "address");
    });

    it("should return 'vec' for scvVec", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvVec([])), "vec");
    });

    it("should return 'map' for scvMap", () => {
      assertEquals(getScValTypeName(xdr.ScVal.scvMap([])), "map");
    });

    it("should return 'error' for scvError", () => {
      assertEquals(
        getScValTypeName(xdr.ScVal.scvError(xdr.ScError.sceContract(1))),
        "error"
      );
    });

    it("should return 'contractInstance' for scvContractInstance", () => {
      const scv = xdr.ScVal.scvContractInstance(
        new xdr.ScContractInstance({
          executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
          storage: null,
        })
      );
      assertEquals(getScValTypeName(scv), "contractInstance");
    });

    it("should return 'ledgerKeyContractInstance' for scvLedgerKeyContractInstance", () => {
      assertEquals(
        getScValTypeName(xdr.ScVal.scvLedgerKeyContractInstance()),
        "ledgerKeyContractInstance"
      );
    });

    it("should return 'ledgerKeyNonce' for scvLedgerKeyNonce", () => {
      const scv = xdr.ScVal.scvLedgerKeyNonce(
        new xdr.ScNonceKey({ nonce: new xdr.Int64(1) })
      );
      assertEquals(getScValTypeName(scv), "ledgerKeyNonce");
    });

    it("should throw error for unknown ScVal type", () => {
      // Create a fake ScVal-like object with an unknown type
      const fakeScVal = {
        switch: () => ({ value: 9999, name: "scvUnknown" }),
      } as unknown as xdr.ScVal;

      assertThrows(
        () => getScValTypeName(fakeScVal),
        Error,
        "Unknown ScVal type: scvUnknown"
      );
    });
  });

  describe("isScValRecord", () => {
    it("should return true for plain objects", () => {
      assertEquals(isScValRecord({ key: "value" }), true);
    });

    it("should return true for empty objects", () => {
      assertEquals(isScValRecord({}), true);
    });

    it("should return false for null", () => {
      assertEquals(isScValRecord(null), false);
    });

    it("should return false for arrays", () => {
      assertEquals(isScValRecord([1, 2, 3]), false);
    });

    it("should return false for Uint8Array", () => {
      assertEquals(isScValRecord(new Uint8Array([1, 2, 3])), false);
    });

    it("should return false for Map", () => {
      assertEquals(isScValRecord(new Map()), false);
    });

    it("should return false for primitives", () => {
      assertEquals(isScValRecord("string"), false);
      assertEquals(isScValRecord(123), false);
      assertEquals(isScValRecord(true), false);
      assertEquals(isScValRecord(123n), false);
    });
  });

  describe("isScValMap", () => {
    it("should return true for Map instances", () => {
      assertEquals(isScValMap(new Map()), true);
    });

    it("should return true for Map with entries", () => {
      const map = new Map<ScValParsed, ScValParsed>();
      map.set("key", "value");
      assertEquals(isScValMap(map), true);
    });

    it("should return false for plain objects", () => {
      assertEquals(isScValMap({ key: "value" }), false);
    });

    it("should return false for arrays", () => {
      assertEquals(isScValMap([1, 2, 3]), false);
    });

    it("should return false for null", () => {
      assertEquals(isScValMap(null), false);
    });

    it("should return false for primitives", () => {
      assertEquals(isScValMap("string"), false);
      assertEquals(isScValMap(123), false);
    });
  });

  describe("asUnion", () => {
    it("should detect union pattern with string tag", () => {
      const value: ScValParsed[] = ["Transfer", "from", "to", 100n];
      const result = asUnion(value);

      assertExists(result);
      assertEquals(result!.tag, "Transfer");
      assertEquals(result!.values, ["from", "to", 100n]);
    });

    it("should return undefined for empty array", () => {
      const result = asUnion([]);

      assertEquals(result, undefined);
    });

    it("should return undefined for array not starting with string", () => {
      const value: ScValParsed[] = [123, "not", "a", "union"];
      const result = asUnion(value);

      assertEquals(result, undefined);
    });

    it("should return undefined for non-array", () => {
      assertEquals(asUnion("not an array"), undefined);
      assertEquals(asUnion(123), undefined);
      assertEquals(asUnion(null), undefined);
      assertEquals(asUnion({ key: "value" }), undefined);
    });

    it("should handle single-element union (void variant)", () => {
      const value: ScValParsed[] = ["None"];
      const result = asUnion(value);

      assertExists(result);
      assertEquals(result!.tag, "None");
      assertEquals(result!.values, []);
    });

    it("should handle union with complex nested values", () => {
      const value: ScValParsed[] = ["Complex", [1, 2, 3], { nested: true }];
      const result = asUnion(value);

      assertExists(result);
      assertEquals(result!.tag, "Complex");
      assertEquals(result!.values.length, 2);
      assertEquals(result!.values[0], [1, 2, 3]);
    });
  });

  describe("integration tests", () => {
    it("should parse a typical transfer event topics", () => {
      const topics = [
        xdr.ScVal.scvSymbol("transfer"),
        new Address(Keypair.random().publicKey()).toScVal(),
        new Address(Keypair.random().publicKey()).toScVal(),
      ];

      const result = parseScVals(topics);

      assertEquals(result.length, 3);
      assertEquals(result[0], "transfer");
      assertEquals(typeof result[1], "string");
      assertEquals(typeof result[2], "string");
    });

    it("should parse a typical event data map", () => {
      const scv = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("amount"),
          val: nativeToScVal(1000000n, { type: "i128" }),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("token"),
          val: new Address(
            "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
          ).toScVal(),
        }),
      ]);

      const result = parseScVal(scv);

      assertEquals(isScValRecord(result), true);
      assertEquals((result as ScValRecord)["amount"], 1000000n);
      assertEquals(
        (result as ScValRecord)["token"],
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
      );
    });

    it("should parse deeply nested structure", () => {
      const scv = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("data"),
          val: xdr.ScVal.scvVec([
            xdr.ScVal.scvMap([
              new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol("id"),
                val: xdr.ScVal.scvU32(1),
              }),
            ]),
            xdr.ScVal.scvMap([
              new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol("id"),
                val: xdr.ScVal.scvU32(2),
              }),
            ]),
          ]),
        }),
      ]);

      const result = parseScVal(scv) as ScValRecord;

      assertEquals(isScValRecord(result), true);
      assertEquals(Array.isArray(result["data"]), true);
      assertEquals((result["data"] as ScValRecord[])[0]["id"], 1);
      assertEquals((result["data"] as ScValRecord[])[1]["id"], 2);
    });
  });
});
