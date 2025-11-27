// deno-lint-ignore-file require-await no-explicit-any
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import {
  isLedgerCloseMetaV1,
  isLedgerCloseMetaV2,
  isIncludedInFilters,
  parseEventsFromLedgerCloseMeta,
} from "./ledger-close-meta.ts";
import type { EventFilter } from "@/event/event-filter/index.ts";
import type { EventType } from "@/event/types.ts";
import type { ContractId } from "@/strkeys/types.ts";
import * as E from "@/event/parsing/error.ts";
import type { Buffer } from "buffer";
import type { BoundedArray } from "@/common/helpers/bounded-array.ts";
import type { TopicFilter } from "@/event/event-filter/types.ts";
import type { Api } from "stellar-sdk/rpc";

// =============================================================================
// Mock Helpers
// =============================================================================

const createMockFilter = (options: {
  matchesType?: (type: EventType) => boolean;
  matchesContractId?: (id: ContractId) => boolean;
  matchesTopics?: (topics: xdr.ScVal[]) => boolean;
}): EventFilter =>
  ({
    matchesType: options.matchesType ?? (() => true),
    matchesContractId: options.matchesContractId ?? (() => true),
    matchesTopics: options.matchesTopics ?? (() => true),
    _type: undefined,
    _contractIds: undefined,
    _topics: undefined,
    encodeTopics: function (
      _topicFilter: TopicFilter
    ): BoundedArray<string, 0, 4> {
      throw new Error("Function not implemented.");
    },
    toRawEventFilter: function (): Api.EventFilter {
      throw new Error("Function not implemented.");
    },
  } as unknown as EventFilter);

const createMockLedgerCloseMeta = (version: number) => {
  return {
    switch: () => version,
    v1: () => createMockLedgerCloseMetaV1V2(),
    v2: () => createMockLedgerCloseMetaV1V2(),
  } as unknown as xdr.LedgerCloseMeta;
};

const createMockLedgerCloseMetaV1V2 = () => ({
  ledgerHeader: () => ({
    header: () => ({
      ledgerSeq: () => 12345,
      scpValue: () => ({
        closeTime: () => ({
          toString: () => "1234567890",
        }),
      }),
    }),
  }),
  txProcessing: () => [],
});

const createMockTxProcessing = (options?: {
  contractId?: Buffer | Uint8Array | null;
  eventType?: string;
  isSuccess?: boolean;
}) => ({
  txApplyProcessing: () => ({
    v4: () => ({
      operations: () => [
        {
          events: () => [
            {
              type: () => ({
                name: options?.eventType ?? "contract",
              }),
              contractId: () => options?.contractId ?? null,
              body: () => ({
                v0: () => ({
                  topics: () => [],
                  data: () => xdr.ScVal.scvVoid(),
                }),
              }),
            },
          ],
        },
      ],
    }),
  }),
  result: () => ({
    transactionHash: () => ({
      toString: () => "abc123def456",
    }),
    result: () => ({
      result: () => ({
        switch: () => ({
          name: options?.isSuccess !== false ? "txSuccess" : "txFailed",
        }),
      }),
    }),
  }),
});

// =============================================================================
// Tests: isLedgerCloseMetaV1
// =============================================================================

describe("isLedgerCloseMetaV1", () => {
  it("returns true for V1 metadata", () => {
    const meta = createMockLedgerCloseMeta(1);
    assertEquals(isLedgerCloseMetaV1(meta), true);
  });

  it("returns false for V2 metadata", () => {
    const meta = createMockLedgerCloseMeta(2);
    assertEquals(isLedgerCloseMetaV1(meta), false);
  });

  it("returns false for other versions", () => {
    const meta = createMockLedgerCloseMeta(0);
    assertEquals(isLedgerCloseMetaV1(meta), false);

    const meta3 = createMockLedgerCloseMeta(3);
    assertEquals(isLedgerCloseMetaV1(meta3), false);
  });
});

// =============================================================================
// Tests: isLedgerCloseMetaV2
// =============================================================================

describe("isLedgerCloseMetaV2", () => {
  it("returns true for V2 metadata", () => {
    const meta = createMockLedgerCloseMeta(2);
    assertEquals(isLedgerCloseMetaV2(meta), true);
  });

  it("returns false for V1 metadata", () => {
    const meta = createMockLedgerCloseMeta(1);
    assertEquals(isLedgerCloseMetaV2(meta), false);
  });

  it("returns false for other versions", () => {
    const meta = createMockLedgerCloseMeta(0);
    assertEquals(isLedgerCloseMetaV2(meta), false);

    const meta3 = createMockLedgerCloseMeta(3);
    assertEquals(isLedgerCloseMetaV2(meta3), false);
  });
});

// =============================================================================
// Tests: isIncludedInFilters
// =============================================================================

describe("isIncludedInFilters", () => {
  describe("no filters", () => {
    it("returns true when filters is empty array", () => {
      const result = isIncludedInFilters({
        filters: [],
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
        type: "contract" as EventType,
        topics: [],
      });
      assertEquals(result, true);
    });
  });

  describe("type matching", () => {
    it("returns true when type matches filter", () => {
      const filter = createMockFilter({
        matchesType: (type) => type === "contract",
      });

      const result = isIncludedInFilters({
        filters: [filter],
        type: "contract" as EventType,
      });
      assertEquals(result, true);
    });

    it("returns false when type does not match any filter", () => {
      const filter = createMockFilter({
        matchesType: (type) => type === "system",
      });

      const result = isIncludedInFilters({
        filters: [filter],
        type: "contract" as EventType,
      });
      assertEquals(result, false);
    });
  });

  describe("contractId matching", () => {
    it("returns true when contractId matches filter", () => {
      const targetId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId;
      const filter = createMockFilter({
        matchesContractId: (id) => id === targetId,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        contractId: targetId,
      });
      assertEquals(result, true);
    });

    it("returns false when contractId does not match any filter", () => {
      const filter = createMockFilter({
        matchesContractId: () => false,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
      });
      assertEquals(result, false);
    });
  });

  describe("topics matching", () => {
    it("returns true when topics match filter", () => {
      const filter = createMockFilter({
        matchesTopics: () => true,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        topics: [xdr.ScVal.scvVoid()],
      });
      assertEquals(result, true);
    });

    it("returns false when topics do not match any filter", () => {
      const filter = createMockFilter({
        matchesTopics: () => false,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        topics: [xdr.ScVal.scvVoid()],
      });
      assertEquals(result, false);
    });
  });

  describe("combined criteria", () => {
    it("returns true when all criteria match on same filter", () => {
      const filter = createMockFilter({
        matchesType: () => true,
        matchesContractId: () => true,
        matchesTopics: () => true,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        type: "contract" as EventType,
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
        topics: [],
      });
      assertEquals(result, true);
    });

    it("returns false when criteria match on different filters", () => {
      const filterA = createMockFilter({
        matchesType: () => true,
        matchesContractId: () => false,
        matchesTopics: () => true,
      });

      const filterB = createMockFilter({
        matchesType: () => false,
        matchesContractId: () => true,
        matchesTopics: () => true,
      });

      const result = isIncludedInFilters({
        filters: [filterA, filterB],
        type: "contract" as EventType,
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
        topics: [],
      });
      assertEquals(result, false);
    });

    it("returns true when second filter matches", () => {
      const filterA = createMockFilter({
        matchesType: () => false,
      });

      const filterB = createMockFilter({
        matchesType: () => true,
        matchesContractId: () => true,
        matchesTopics: () => true,
      });

      const result = isIncludedInFilters({
        filters: [filterA, filterB],
        type: "contract" as EventType,
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
        topics: [],
      });
      assertEquals(result, true);
    });
  });

  describe("undefined criteria", () => {
    it("skips type check when type is undefined", () => {
      const filter = createMockFilter({
        matchesType: () => false, // Would fail if called
        matchesContractId: () => true,
        matchesTopics: () => true,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        type: undefined,
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
        topics: [],
      });
      assertEquals(result, true);
    });

    it("skips contractId check when contractId is undefined", () => {
      const filter = createMockFilter({
        matchesType: () => true,
        matchesContractId: () => false, // Would fail if called
        matchesTopics: () => true,
      });

      const result = isIncludedInFilters({
        filters: [filter],
        type: "contract" as EventType,
        contractId: undefined,
        topics: [],
      });
      assertEquals(result, true);
    });

    it("skips topics check when topics is undefined", () => {
      const filter = createMockFilter({
        matchesType: () => true,
        matchesContractId: () => true,
        matchesTopics: () => false, // Would fail if called
      });

      const result = isIncludedInFilters({
        filters: [filter],
        type: "contract" as EventType,
        contractId:
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
        topics: undefined,
      });
      assertEquals(result, true);
    });
  });
});

// =============================================================================
// Tests: parseEventsFromLedgerCloseMeta
// =============================================================================

describe("parseEventsFromLedgerCloseMeta", () => {
  describe("validation", () => {
    it("throws INVALID_LEDGER_CLOSE_META_XDR for invalid XDR", async () => {
      // Mock isValid to return false
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => false;

      try {
        const meta = createMockLedgerCloseMeta(1);
        await assertRejects(
          () => parseEventsFromLedgerCloseMeta(meta, async () => {}),
          E.INVALID_LEDGER_CLOSE_META_XDR
        );
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("throws UNSUPPORTED_LEDGER_CLOSE_META_VERSION for unsupported version", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      try {
        const meta = createMockLedgerCloseMeta(0); // Version 0 is unsupported
        await assertRejects(
          () => parseEventsFromLedgerCloseMeta(meta, async () => {}),
          E.UNSUPPORTED_LEDGER_CLOSE_META_VERSION
        );
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("throws UNSUPPORTED_LEDGER_CLOSE_META_VERSION for version 3", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      try {
        const meta = createMockLedgerCloseMeta(3);
        await assertRejects(
          () => parseEventsFromLedgerCloseMeta(meta, async () => {}),
          E.UNSUPPORTED_LEDGER_CLOSE_META_VERSION
        );
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });
  });

  describe("event parsing", () => {
    it("calls onEvent for each event in V1 metadata", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: unknown[] = [];
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing()],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: unknown) => {
            events.push(event);
          }
        );

        assertEquals(events.length, 1);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("calls onEvent for each event in V2 metadata", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: unknown[] = [];
      const mockMeta = {
        switch: () => 2,
        v2: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 200,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing()],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: unknown) => {
            events.push(event);
          }
        );

        assertEquals(events.length, 1);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts correct ledger sequence", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { ledger?: number } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 54321,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing()],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { ledger?: number }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.ledger, 54321);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts correct ledgerClosedAt", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { ledgerClosedAt?: string } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1699999999",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing()],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { ledgerClosedAt?: string }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.ledgerClosedAt, "1699999999");
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts correct txHash", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { txHash?: string } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing()],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { txHash?: string }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.txHash, "abc123def456");
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts correct transactionIndex", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: { transactionIndex?: number }[] = [];
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [
            createMockTxProcessing(),
            createMockTxProcessing(),
          ],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { transactionIndex?: number }) => {
            events.push(event);
          }
        );

        assertEquals(events[0].transactionIndex, 1);
        assertEquals(events[1].transactionIndex, 2);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts correct operationIndex", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: { operationIndex?: number }[] = [];
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [
            {
              txApplyProcessing: () => ({
                v4: () => ({
                  operations: () => [
                    {
                      events: () => [
                        {
                          type: () => ({ name: "contract" }),
                          contractId: () => null,
                          body: () => ({
                            v0: () => ({
                              topics: () => [],
                              data: () => xdr.ScVal.scvVoid(),
                            }),
                          }),
                        },
                      ],
                    },
                    {
                      events: () => [
                        {
                          type: () => ({ name: "contract" }),
                          contractId: () => null,
                          body: () => ({
                            v0: () => ({
                              topics: () => [],
                              data: () => xdr.ScVal.scvVoid(),
                            }),
                          }),
                        },
                      ],
                    },
                  ],
                }),
              }),
              result: () => ({
                transactionHash: () => ({
                  toString: () => "hash",
                }),
                result: () => ({
                  result: () => ({
                    switch: () => ({ name: "txSuccess" }),
                  }),
                }),
              }),
            },
          ],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { operationIndex?: number }) => {
            events.push(event);
          }
        );

        assertEquals(events[0].operationIndex, 1);
        assertEquals(events[1].operationIndex, 2);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts correct event type", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { type?: string } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing({ eventType: "system" })],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { type?: string }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.type, "system");
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("sets inSuccessfulContractCall correctly for success", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { inSuccessfulContractCall?: boolean } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing({ isSuccess: true })],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { inSuccessfulContractCall?: boolean }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.inSuccessfulContractCall, true);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("sets inSuccessfulContractCall correctly for failure", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { inSuccessfulContractCall?: boolean } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing({ isSuccess: false })],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { inSuccessfulContractCall?: boolean }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.inSuccessfulContractCall, false);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("handles null contract ID", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      let capturedEvent: { contractId?: unknown } = {};
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing({ contractId: null })],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: { contractId?: unknown }) => {
            capturedEvent = event;
          }
        );

        assertEquals(capturedEvent.contractId, undefined);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("extracts contract ID when present", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      // Create a valid 32-byte contract ID buffer
      const contractIdBuffer = new Uint8Array(32);
      contractIdBuffer.fill(0xab);

      let capturedEvent: any = undefined;
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [
            createMockTxProcessing({ contractId: contractIdBuffer }),
          ],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(mockMeta, async (event: any) => {
          capturedEvent = event;
        });

        // Verify the contract was created and has an address
        assertExists(capturedEvent);
        assertExists(capturedEvent.contractId);
        const address = capturedEvent.contractId;
        assertEquals(typeof address, "string");
        assertEquals(address.startsWith("C"), true);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });
  });

  describe("filtering", () => {
    it("calls onEvent for all events when filters is explicitly undefined", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: unknown[] = [];
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [
            createMockTxProcessing(),
            createMockTxProcessing(),
          ],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        // Explicitly pass undefined as filters to test the `filters || []` fallback
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: unknown) => {
            events.push(event);
          },
          undefined
        );

        assertEquals(events.length, 2);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("calls onEvent for all events when no filters provided", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: unknown[] = [];
      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [
            createMockTxProcessing(),
            createMockTxProcessing(),
          ],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: unknown) => {
            events.push(event);
          }
        );

        assertEquals(events.length, 2);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("applies filters to events", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: unknown[] = [];
      const filter = createMockFilter({
        matchesType: (type) => type === "system",
      });

      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [
            createMockTxProcessing({ eventType: "contract" }),
            createMockTxProcessing({ eventType: "system" }),
          ],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: unknown) => {
            events.push(event);
          },
          [filter]
        );

        assertEquals(events.length, 1);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });

    it("does not call onEvent for non-matching events", async () => {
      const originalIsValid = xdr.LedgerCloseMeta.isValid;
      xdr.LedgerCloseMeta.isValid = () => true;

      const events: unknown[] = [];
      const filter = createMockFilter({
        matchesType: () => false,
      });

      const mockMeta = {
        switch: () => 1,
        v1: () => ({
          ledgerHeader: () => ({
            header: () => ({
              ledgerSeq: () => 100,
              scpValue: () => ({
                closeTime: () => ({
                  toString: () => "1700000000",
                }),
              }),
            }),
          }),
          txProcessing: () => [createMockTxProcessing()],
        }),
      } as unknown as xdr.LedgerCloseMeta;

      try {
        await parseEventsFromLedgerCloseMeta(
          mockMeta,
          async (event: unknown) => {
            events.push(event);
          },
          [filter]
        );

        assertEquals(events.length, 0);
      } finally {
        xdr.LedgerCloseMeta.isValid = originalIsValid;
      }
    });
  });
});
