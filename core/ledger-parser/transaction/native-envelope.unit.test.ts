import {
  assert,
  assertEquals,
  assertNotStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  FeeBumpTransaction,
  Networks,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import { Transaction } from "@/ledger-parser/transaction/index.ts";
import * as E from "@/ledger-parser/error.ts";
import { getLedgerFixture } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";

describe("Native transaction context", () => {
  const ledger = Ledger.fromEntry(getLedgerFixture(60661500)!);
  const meta = ledger.meta;
  assert(meta.type === "v2");
  assert(meta.v2.txSet.type === "v1TxSet");
  const envelopes = meta.v2.txSet.v1TxSet.phases.flatMap((phase) =>
    phase.type === "v0Components"
      ? phase.v0Components.flatMap((component) =>
        component.txsMaybeDiscountedFee.txs
      )
      : phase.parallelTxsComponent.executionStages.flatMap((stage) =>
        stage.flatMap((cluster) => cluster)
      )
  );
  const byHash = new Map(envelopes.map((envelope) => {
    const native = TransactionBuilder.fromXdr(
      envelope.toXdr("base64"),
      Networks.PUBLIC,
    );
    return [xdr.encodeBytes(native.hash(), "hex"), { envelope, native }];
  }));

  it("distinguishes fee payer, inner source and effective operation source using independently matched ledger XDR", () => {
    let feeBumps = 0;
    for (const [index, result] of meta.v2.txProcessing.entries()) {
      const hash = xdr.encodeBytes(
        result.result.transactionHash.toBytes(),
        "hex",
      );
      const match = byHash.get(hash);
      assert(match);
      const parsed = Transaction.fromMetaWithEnvelope(
        ledger,
        result,
        match.envelope,
        index,
      );
      const native = match.native;
      const inner = native instanceof FeeBumpTransaction
        ? native.innerTransaction
        : native;
      assertEquals(parsed.hash, hash);
      assertEquals(parsed.sourceAccount, inner.source);
      assertEquals(
        parsed.feeSource,
        native instanceof FeeBumpTransaction ? native.feeSource : native.source,
      );
      assertEquals(parsed.toJSON().feeSource, parsed.feeSource);
      const copy = parsed.toEnvelope();
      assertNotStrictEquals(copy, match.envelope);
      assertEquals(copy.toXdr("base64"), match.envelope.toXdr("base64"));
      assertEquals(parsed.operations.length, inner.operations.length);
      for (const [i, operation] of parsed.operations.entries()) {
        assertEquals(
          operation.sourceAccount,
          inner.operations[i].source ?? inner.source,
        );
        assertEquals(operation.toOperation(), inner.operations[i]);
      }
      if (native instanceof FeeBumpTransaction) feeBumps++;
    }
    assert(feeBumps > 0);
  });

  it("identifies unavailable or malformed native envelope access at separate failure sites", () => {
    const result = meta.v2.txProcessing[0];
    const parsed = Transaction.fromMeta(ledger, result, 0);
    const feeSource = assertThrows(
      () => parsed.feeSource,
      E.MISSING_FEE_SOURCE_ENVELOPE,
    );
    const envelope = assertThrows(
      () => parsed.toEnvelope(),
      E.MISSING_NATIVE_ENVELOPE,
    );
    const malformed = Transaction.fromMetaWithEnvelope(
      ledger,
      result,
      {} as xdr.TransactionEnvelope,
      0,
    );
    const decoding = assertThrows(
      () => malformed.toEnvelope(),
      E.NATIVE_ENVELOPE_DECODE_FAILED,
    );
    assert(decoding.meta.cause instanceof Error);
    for (const error of [feeSource, envelope, decoding]) {
      assertEquals(E.ERROR_LDP[error.code], error.constructor);
    }
  });
});
