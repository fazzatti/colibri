/**
 * CAP-0067 Muxed Transfer Events Integration Test
 *
 * This test verifies that the EventStreamer and SAC TransferEvent
 * correctly handle muxed address events introduced in CAP-0067.
 *
 * Ledger 60044284 on Mainnet contains known XLM transfer events including
 * muxed transfers where the value is a map { amount, to_muxed_id } instead
 * of a simple i128.
 *
 * @see https://stellar.expert/explorer/public/tx/4ffd03c2d3c60f8a81cb09cf96ab75ec33c31d925e57bc5e23e1af6082ad6f17
 */

import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists } from "@std/assert";
import { describe, it, afterEach } from "@std/testing/bdd";
import {
  EventFilter,
  EventType,
  NetworkProviders,
  type Event,
  SACEvents,
} from "@colibri/core";
import { EventStreamer } from "@colibri/event-streamer";

// =============================================================================
// Test Constants
// =============================================================================

// XLM Contract on Mainnet
const XLM_CONTRACT_ID_MAINNET =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

// Known ledger with muxed transfer events
const MUXED_TRANSFER_LEDGER = 60044284;

// Expected number of XLM transfer events in ledger 60044284
// This includes both simple i128 transfers and muxed map transfers
const EXPECTED_TRANSFER_COUNT = 45;

// =============================================================================
// Tests
// =============================================================================

describe(
  "[Mainnet] CAP-0067 Muxed Transfer Events",
  disableSanitizeConfig,

  () => {
    const networkConfig = NetworkProviders.Lightsail.MainNet();

    let eventStreamer: EventStreamer;

    afterEach(() => {
      if (eventStreamer) {
        eventStreamer.stop();
      }
    });

    it("ingests XLM transfer events including muxed formats from ledger 60044284", async () => {
      const events: Event[] = [];
      const transferEvents: InstanceType<typeof SACEvents.TransferEvent>[] = [];
      const muxedTransfers: InstanceType<typeof SACEvents.TransferEvent>[] = [];

      const filter = new EventFilter({
        contractIds: [XLM_CONTRACT_ID_MAINNET],
        type: EventType.Contract,
        topics: [SACEvents.TransferEvent.toTopicFilter()],
      });

      eventStreamer = new EventStreamer({
        rpcUrl: networkConfig.rpcUrl,
        archiveRpcUrl: networkConfig.archiveRpcUrl,
        filters: [filter],
        options: {
          skipLedgerWaitIfBehind: true,
        },
      });

      const handler = (event: Event) => {
        events.push(event);

        // Verify TransferEvent.is() accepts all events (including muxed)
        if (SACEvents.TransferEvent.is(event)) {
          const transfer = SACEvents.TransferEvent.fromEvent(event);
          transferEvents.push(transfer);

          if (transfer.hasMuxedId()) {
            muxedTransfers.push(transfer);
          }
        }
      };

      await eventStreamer.startArchive(handler, {
        startLedger: MUXED_TRANSFER_LEDGER,
        stopLedger: MUXED_TRANSFER_LEDGER,
      });

      // Verify we got the expected number of events
      assertEquals(
        events.length,
        EXPECTED_TRANSFER_COUNT,
        `Expected ${EXPECTED_TRANSFER_COUNT} XLM transfer events in ledger ${MUXED_TRANSFER_LEDGER}`
      );

      // Verify all events were successfully parsed as TransferEvents
      assertEquals(
        transferEvents.length,
        EXPECTED_TRANSFER_COUNT,
        "All events should be parseable as SAC TransferEvents (including muxed)"
      );

      // Verify we found at least one muxed transfer
      assertEquals(
        muxedTransfers.length > 0,
        true,
        "Expected at least one muxed transfer event in ledger 60044284"
      );
    });

    it("correctly extracts amount from muxed transfer events", async () => {
      let foundMuxedTransfer = false;

      const filter = new EventFilter({
        contractIds: [XLM_CONTRACT_ID_MAINNET],
        type: EventType.Contract,
        topics: [SACEvents.TransferEvent.toTopicFilter()],
      });

      eventStreamer = new EventStreamer({
        rpcUrl: networkConfig.rpcUrl,
        archiveRpcUrl: networkConfig.archiveRpcUrl,
        filters: [filter],
        options: {
          skipLedgerWaitIfBehind: true,
        },
      });

      const handler = (event: Event) => {
        if (SACEvents.TransferEvent.is(event)) {
          const transfer = SACEvents.TransferEvent.fromEvent(event);

          if (transfer.hasMuxedId()) {
            foundMuxedTransfer = true;

            // Verify amount is correctly extracted from muxed data
            assertExists(transfer.amount, "Muxed transfer should have amount");
            assertEquals(
              typeof transfer.amount,
              "bigint",
              "Amount should be bigint"
            );
            assertEquals(
              transfer.amount > 0n,
              true,
              "Amount should be positive"
            );

            // Verify muxed ID is present
            assertExists(
              transfer.toMuxedId,
              "Muxed transfer should have toMuxedId"
            );

            // Verify asset is native
            assertEquals(
              transfer.asset,
              "native",
              "XLM transfers should have native asset"
            );

            eventStreamer.stop();
          }
        }
      };

      await eventStreamer.startArchive(handler, {
        startLedger: MUXED_TRANSFER_LEDGER,
        stopLedger: MUXED_TRANSFER_LEDGER,
      });

      assertEquals(
        foundMuxedTransfer,
        true,
        "Should find at least one muxed transfer event"
      );
    });

    it("TransferEvent.is() returns true for both simple and muxed value formats", async () => {
      let simpleTransferCount = 0;
      let muxedTransferCount = 0;
      let failedIsCheckCount = 0;

      const filter = new EventFilter({
        contractIds: [XLM_CONTRACT_ID_MAINNET],
        type: EventType.Contract,
        topics: [SACEvents.TransferEvent.toTopicFilter()],
      });

      eventStreamer = new EventStreamer({
        rpcUrl: networkConfig.rpcUrl,
        archiveRpcUrl: networkConfig.archiveRpcUrl,
        filters: [filter],
        options: {
          skipLedgerWaitIfBehind: true,
        },
      });

      const handler = (event: Event) => {
        // The is() check should pass for ALL transfer events
        if (SACEvents.TransferEvent.is(event)) {
          const transfer = SACEvents.TransferEvent.fromEvent(event);

          if (transfer.hasMuxedId()) {
            muxedTransferCount++;
          } else {
            simpleTransferCount++;
          }
        } else {
          // This should NOT happen - if it does, our is() override is broken
          failedIsCheckCount++;
        }
      };

      await eventStreamer.startArchive(handler, {
        startLedger: MUXED_TRANSFER_LEDGER,
        stopLedger: MUXED_TRANSFER_LEDGER,
      });

      // No events should fail the is() check
      assertEquals(
        failedIsCheckCount,
        0,
        "All transfer events should pass TransferEvent.is() check"
      );

      // We should have both types
      assertEquals(
        simpleTransferCount > 0,
        true,
        "Should have simple i128 transfers"
      );
      assertEquals(
        muxedTransferCount > 0,
        true,
        "Should have muxed map transfers"
      );

      // Total should match expected
      assertEquals(
        simpleTransferCount + muxedTransferCount,
        EXPECTED_TRANSFER_COUNT,
        "Total transfers should match expected count"
      );
    });
  }
);
