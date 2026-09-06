import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  FeeBumpTransaction,
  Networks,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Ledger } from "@/ledger-parser/ledger/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { matchTransactionEnvelopes } from "@/ledger-parser/ledger/match-envelopes.ts";
import * as E from "@/ledger-parser/error.ts";
import { loadLedgerFixtures } from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";

const fixtures = loadLedgerFixtures();

describe("Ledger network-bound envelope association", () => {
  it("matches every native envelope independently across v0/v1/v2 in result order", () => {
    let failed = 0;
    let feeBumps = 0;
    for (const entry of fixtures) {
      const ledger = Ledger.fromEntry(entry, NetworkConfig.MainNet());
      const decoded = Ledger.fromEntry({
        ...entry,
        headerXdr: xdr.LedgerHeaderHistoryEntry.fromXdr(
          entry.headerXdr,
          "base64",
        ),
        metadataXdr: xdr.LedgerCloseMeta.fromXdr(entry.metadataXdr, "base64"),
      }, Networks.PUBLIC);
      const meta = ledger.meta;
      const results = meta.type === "v0"
        ? meta.v0.txProcessing
        : meta.type === "v1"
        ? meta.v1.txProcessing
        : meta.v2.txProcessing;
      assertEquals(ledger.transactions.length, results.length);
      for (const [index, tx] of ledger.transactions.entries()) {
        const native = TransactionBuilder.fromXdr(
          tx.toEnvelope().toXdr("base64"),
          Networks.PUBLIC,
        );
        assertEquals(
          xdr.encodeBytes(native.hash(), "hex"),
          results[index].result.transactionHash.toXdr("hex"),
        );
        assertEquals(tx.hash, xdr.encodeBytes(native.hash(), "hex"));
        assertEquals(tx.index, index);
        const inner = native instanceof FeeBumpTransaction
          ? native.innerTransaction
          : native;
        assertEquals(tx.sourceAccount, inner.source);
        assertEquals(
          tx.operations.map((op) => op.toOperation()),
          inner.operations,
        );
        assertEquals(
          decoded.transactions[index].toEnvelope().toXdr("base64"),
          tx.toEnvelope().toXdr("base64"),
        );
        if (!tx.successful) failed++;
        if (native instanceof FeeBumpTransaction) feeBumps++;
      }
    }
    assert(failed > 0);
    assert(feeBumps > 0);
  });

  it("keeps offline result reads available without guessing a network", () => {
    const ledger = Ledger.fromEntry(fixtures[0]);
    const tx = ledger.transactions[0];
    assertEquals(tx.hasEnvelope, false);
    assert(tx.hash.length === 64);
    assertEquals(typeof tx.successful, "boolean");
    assertThrows(() => tx.toEnvelope(), E.MISSING_NATIVE_ENVELOPE);
    assertThrows(() => tx.sourceAccount, E.MISSING_TRANSACTION_ENVELOPE);
    assertThrows(
      () => Ledger.fromEntry(fixtures[0], "").transactions,
      E.INVALID_NETWORK_PASSPHRASE,
    );
    assertThrows(
      () =>
        Ledger.fromEntry(
          fixtures[0],
          { networkPassphrase: 3 } as unknown as NetworkConfig,
        ),
      E.INVALID_NETWORK_PASSPHRASE,
    );
    assertThrows(
      () => Ledger.fromEntry(fixtures[0], Networks.TESTNET).transactions,
      E.RESULT_ENVELOPE_NOT_FOUND,
    );
  });

  it("rejects incomplete, ambiguous and malformed associations with unique errors", () => {
    const ledger = Ledger.fromEntry(fixtures[0], Networks.PUBLIC);
    const meta = ledger.meta;
    assert(meta.type === "v0");
    const results = meta.v0.txProcessing;
    const envelopes = ledger.transactions.map((tx) => tx.toEnvelope());
    const failures = [
      assertThrows(
        () => matchTransactionEnvelopes(results, [], Networks.PUBLIC),
        E.RESULT_ENVELOPE_NOT_FOUND,
      ),
      assertThrows(
        () =>
          matchTransactionEnvelopes(
            results,
            [envelopes[0], envelopes[0]],
            Networks.PUBLIC,
          ),
        E.DUPLICATE_ENVELOPE_HASH,
      ),
      assertThrows(
        () => matchTransactionEnvelopes([], envelopes, Networks.PUBLIC),
        E.UNMATCHED_TRANSACTION_ENVELOPES,
      ),
      assertThrows(
        () =>
          matchTransactionEnvelopes(
            [],
            [{} as xdr.TransactionEnvelope],
            Networks.PUBLIC,
          ),
        E.ENVELOPE_HASH_FAILED,
      ),
      assertThrows(
        () => Ledger.fromEntry(fixtures[0], ""),
        E.INVALID_NETWORK_PASSPHRASE,
      ),
    ];
    for (const error of failures) {
      assertEquals(E.ERROR_LDP[error.code], error.constructor);
    }
    assert(failures[3].meta.cause instanceof Error);
    assertEquals(matchTransactionEnvelopes([], [], Networks.PUBLIC), []);
  });
});
