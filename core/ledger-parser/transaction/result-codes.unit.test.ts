import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { loadV2Fixtures } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import { Transaction } from "@/ledger-parser/transaction/index.ts";
import { parseEventsFromLedgerCloseMeta } from "@/event/parsing/ledger-close-meta.ts";

const innerResult = (success: boolean): xdr.InnerTransactionResultPair =>
  new xdr.InnerTransactionResultPair({
    transactionHash: new xdr.Hash(new Uint8Array(32).fill(1)),
    result: new xdr.InnerTransactionResult({
      feeCharged: 100n,
      result: success
        ? xdr.InnerTransactionResultResult.txSuccess([])
        : xdr.InnerTransactionResultResult.txFailed([]),
      ext: xdr.InnerTransactionResultExt.v0(),
    }),
  });

const results = [
  xdr.TransactionResultResult.txSuccess([]),
  xdr.TransactionResultResult.txFailed([]),
  xdr.TransactionResultResult.txTooEarly(),
  xdr.TransactionResultResult.txTooLate(),
  xdr.TransactionResultResult.txMissingOperation(),
  xdr.TransactionResultResult.txBadSeq(),
  xdr.TransactionResultResult.txBadAuth(),
  xdr.TransactionResultResult.txInsufficientBalance(),
  xdr.TransactionResultResult.txNoAccount(),
  xdr.TransactionResultResult.txInsufficientFee(),
  xdr.TransactionResultResult.txBadAuthExtra(),
  xdr.TransactionResultResult.txInternalError(),
  xdr.TransactionResultResult.txNotSupported(),
  xdr.TransactionResultResult.txBadSponsorship(),
  xdr.TransactionResultResult.txBadMinSeqAgeOrGap(),
  xdr.TransactionResultResult.txMalformed(),
  xdr.TransactionResultResult.txSorobanInvalid(),
  xdr.TransactionResultResult.txFrozenKeyAccessed(),
  xdr.TransactionResultResult.txFeeBumpInnerSuccess(innerResult(true)),
  xdr.TransactionResultResult.txFeeBumpInnerFailed(innerResult(false)),
];

describe("native ledger transaction result semantics", () => {
  const fixture = loadV2Fixtures()[0];
  const ledger = Ledger.fromEntry(fixture);
  const metadata = xdr.LedgerCloseMeta.fromXdr(fixture.metadataXdr, "base64");
  assert(metadata.type === "v2");
  const processing = metadata.v2.txProcessing.find((entry) =>
    entry.txApplyProcessing.type === "v4" &&
    entry.txApplyProcessing.v4.operations.some((operation) =>
      operation.events.length > 0
    )
  );
  assert(processing);

  for (const result of results) {
    it(`preserves the native ${result.type} result code and success semantics`, () => {
      const resultMeta = new xdr.TransactionResultMeta({
        ...processing,
        result: new xdr.TransactionResultPair({
          ...processing.result,
          result: new xdr.TransactionResult({
            ...processing.result.result,
            result,
          }),
        }),
      });
      // Round-trip through the native XDR codec so hand-written mock enum
      // numbers cannot make these tests agree with an incorrect lookup table.
      const parsed = Transaction.fromMeta(
        ledger,
        xdr.TransactionResultMeta.fromXdr(resultMeta.toXdr()),
        0,
      );
      assertEquals(parsed.resultCode, result.type);
      assertEquals(
        parsed.successful,
        result.type === "txSuccess" || result.type === "txFeeBumpInnerSuccess",
      );
      if (result.type === "txBadSeq") {
        assertEquals(result.toXdrObject().code, -5);
      }
      if (result.type === "txFeeBumpInnerSuccess") {
        assertEquals(result.toXdrObject().code, 1);
      }
    });
  }

  for (const result of [results[0], results[1], results[18], results[19]]) {
    it(`marks archived events correctly for ${result.type}`, async () => {
      const modified = xdr.LedgerCloseMeta.v2(
        new xdr.LedgerCloseMetaV2({
          ...metadata.v2,
          txProcessing: [
            new xdr.TransactionResultMetaV1({
              ...processing,
              result: new xdr.TransactionResultPair({
                ...processing.result,
                result: new xdr.TransactionResult({
                  ...processing.result.result,
                  result,
                }),
              }),
            }),
          ],
        }),
      );
      const statuses: boolean[] = [];
      await parseEventsFromLedgerCloseMeta(
        xdr.LedgerCloseMeta.fromXdr(modified.toXdr()),
        (event) => {
          statuses.push(event.inSuccessfulContractCall);
        },
      );
      assert(statuses.length > 0);
      assertEquals(
        statuses,
        statuses.map(() =>
          result.type === "txSuccess" || result.type === "txFeeBumpInnerSuccess"
        ),
      );
    });
  }
});
