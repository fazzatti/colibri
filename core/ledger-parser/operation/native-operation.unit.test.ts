import { assertEquals, assertInstanceOf, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Asset,
  Keypair,
  Operation as NativeOperation,
  type xdr,
} from "stellar-sdk";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import { Operation } from "@/ledger-parser/operation/index.ts";
import * as E from "@/ledger-parser/error.ts";
import { getLedgerFixture } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";

describe("Ledger operation native SDK conversion", () => {
  const transaction =
    Ledger.fromEntry(getLedgerFixture(60661500)!).transactions[0];

  it("returns the native discriminated record with native decimal amount units", () => {
    const raw = NativeOperation.payment({
      destination: Keypair.random().publicKey(),
      asset: Asset.native(),
      amount: "1.2345678",
    });
    const parsed = Operation.fromXdr(transaction, raw, 0);
    const native = parsed.toOperation();
    assertEquals(native, NativeOperation.fromXdrObject(raw));
    if (native.type === "payment") {
      assertEquals(native.amount, "1.2345678");
      assertInstanceOf(native.asset, Asset);
    } else throw new Error("Expected a native payment record");
    assertEquals((parsed.body as { amount: string }).amount, "12345678");
  });

  it("wraps malformed native operation decoding in a unique typed error", () => {
    const parsed = Operation.fromXdr(transaction, {} as xdr.Operation, 3);
    const error = assertThrows(
      () => parsed.toOperation(),
      E.NATIVE_OPERATION_DECODE_FAILED,
    );
    assertEquals(error.code, E.Code.NATIVE_OPERATION_DECODE_FAILED);
    assertEquals(error.meta.data, { index: 3 });
    assertInstanceOf(error.meta.cause, Error);
    assertEquals(E.ERROR_LDP[error.code], E.NATIVE_OPERATION_DECODE_FAILED);
  });
});
