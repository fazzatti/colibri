import { assertEquals, assertInstanceOf, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Event } from "@/event/event.ts";
import { EventType } from "@/event/types.ts";
import { ApproveEvent } from "@/event/standards/sep41/approve.ts";
import { BurnEvent } from "@/event/standards/sep41/burn.ts";
import { ClawbackEvent } from "@/event/standards/sep41/clawback.ts";
import { MintEvent } from "@/event/standards/sep41/mint.ts";
import { TransferEvent } from "@/event/standards/sep41/transfer.ts";
import { SEP41Events } from "@/event/standards/sep41/index.ts";
import * as E from "@/event/error.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { Address, Keypair, nativeToScVal, xdr } from "stellar-sdk";

const CONTRACT_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId;
const from = Keypair.random().publicKey();
const to = Keypair.random().publicKey();
const spender = Keypair.random().publicKey();

const createEvent = (topics: xdr.ScVal[], value: xdr.ScVal): Event =>
  new Event({
    id: "0000000000000000000-0000000000",
    type: EventType.Contract,
    ledger: 12345,
    ledgerClosedAt: "2026-09-03T00:00:00Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "abc123",
    contractId: CONTRACT_ID,
    topic: topics,
    value,
  });

const entry = (key: xdr.ScVal, value: xdr.ScVal): xdr.ScMapEntry =>
  new xdr.ScMapEntry({ key, val: value });

const symbolEntry = (key: string, value: xdr.ScVal): xdr.ScMapEntry =>
  entry(xdr.ScVal.scvSymbol(key), value);

const amountMap = (
  amount = 100n,
  extra: xdr.ScMapEntry[] = [],
): xdr.ScVal =>
  xdr.ScVal.scvMap([
    symbolEntry("amount", nativeToScVal(amount, { type: "i128" })),
    ...extra,
  ]);

const transferTopics = (): xdr.ScVal[] => [
  xdr.ScVal.scvSymbol("transfer"),
  new Address(from).toScVal(),
  new Address(to).toScVal(),
];

const approveTopics = (): xdr.ScVal[] => [
  xdr.ScVal.scvSymbol("approve"),
  new Address(from).toScVal(),
  new Address(spender).toScVal(),
];

const amountTopics = (name: "burn" | "clawback"): xdr.ScVal[] => [
  xdr.ScVal.scvSymbol(name),
  new Address(from).toScVal(),
];

describe("SEP-41 v0.5.1 event compatibility", () => {
  it("reports the implemented SEP revision", () => {
    assertEquals(SEP41Events.VERSION, "0.5.1");
  });

  it("accepts and reads the approve vector and map representations", () => {
    const vector = createEvent(
      approveTopics(),
      xdr.ScVal.scvVec([
        nativeToScVal(100n, { type: "i128" }),
        xdr.ScVal.scvU32(500),
      ]),
    );
    const map = createEvent(
      approveTopics(),
      xdr.ScVal.scvMap([
        symbolEntry("amount", nativeToScVal(200n, { type: "i128" })),
        symbolEntry("live_until_ledger", xdr.ScVal.scvU32(600)),
        symbolEntry("reference", xdr.ScVal.scvString("invoice-42")),
      ]),
    );

    assertEquals(ApproveEvent.is(vector), true);
    assertEquals(ApproveEvent.is(map), true);
    assertEquals(ApproveEvent.fromEvent(vector).amount, 100n);
    assertEquals(ApproveEvent.fromEvent(vector).liveUntilLedger, 500);
    assertEquals(ApproveEvent.fromEvent(vector).extensions, {});
    const parsed = ApproveEvent.fromEvent(map);
    assertEquals(parsed.amount, 200n);
    assertEquals(parsed.liveUntilLedger, 600);
    assertEquals(parsed.extensions, { reference: "invoice-42" });
    assertEquals(Object.isFrozen(parsed.extensions), true);
  });

  it("requires the exact standardized approve fields and types", () => {
    const values = [
      xdr.ScVal.scvVec([nativeToScVal(100n, { type: "i128" })]),
      xdr.ScVal.scvVec([
        nativeToScVal(100n, { type: "i128" }),
        xdr.ScVal.scvU32(500),
        xdr.ScVal.scvBool(true),
      ]),
      xdr.ScVal.scvVec([
        xdr.ScVal.scvU32(100),
        xdr.ScVal.scvU32(500),
      ]),
      xdr.ScVal.scvVec([
        nativeToScVal(100n, { type: "i128" }),
        nativeToScVal(500n, { type: "u64" }),
      ]),
      xdr.ScVal.scvMap([
        symbolEntry("amount", nativeToScVal(100n, { type: "i128" })),
      ]),
      xdr.ScVal.scvMap([
        symbolEntry("amount", xdr.ScVal.scvU32(100)),
        symbolEntry("live_until_ledger", xdr.ScVal.scvU32(500)),
      ]),
      xdr.ScVal.scvMap([
        symbolEntry("amount", nativeToScVal(100n, { type: "i128" })),
        symbolEntry(
          "live_until_ledger",
          nativeToScVal(500n, { type: "u64" }),
        ),
      ]),
    ];

    assertEquals(
      values.map((value) =>
        ApproveEvent.is(createEvent(approveTopics(), value))
      ),
      values.map(() => false),
    );
  });

  it("accepts map data for transfer, burn, mint, and clawback", () => {
    const transfer = TransferEvent.fromEvent(
      createEvent(
        transferTopics(),
        amountMap(101n, [
          symbolEntry("reference", xdr.ScVal.scvString("payment-1")),
        ]),
      ),
    );
    const burn = BurnEvent.fromEvent(
      createEvent(
        amountTopics("burn"),
        amountMap(102n, [symbolEntry("reason", xdr.ScVal.scvSymbol("redeem"))]),
      ),
    );
    const mint = MintEvent.fromEvent(
      createEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        amountMap(103n, [symbolEntry("batch", xdr.ScVal.scvU32(7))]),
      ),
    );
    const clawback = ClawbackEvent.fromEvent(
      createEvent(
        amountTopics("clawback"),
        amountMap(104n, [symbolEntry("case", xdr.ScVal.scvString("case-9"))]),
      ),
    );

    assertEquals(transfer.amount, 101n);
    assertEquals(transfer.extensions, { reference: "payment-1" });
    assertEquals(burn.amount, 102n);
    assertEquals(burn.extensions, { reason: "redeem" });
    assertEquals(mint.amount, 103n);
    assertEquals(mint.extensions, { batch: 7 });
    assertEquals(clawback.amount, 104n);
    assertEquals(clawback.extensions, { case: "case-9" });
  });

  it("accepts each standardized to_muxed_id representation", () => {
    const muxedIds = [
      xdr.ScVal.scvVoid(),
      nativeToScVal(42n, { type: "u64" }),
      xdr.ScVal.scvString("42"),
      xdr.ScVal.scvBytes(Uint8Array.of(4, 2)),
    ];

    for (const muxedId of muxedIds) {
      const transfer = TransferEvent.fromEvent(
        createEvent(
          transferTopics(),
          amountMap(100n, [symbolEntry("to_muxed_id", muxedId)]),
        ),
      );
      const mint = MintEvent.fromEvent(
        createEvent(
          [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
          amountMap(100n, [symbolEntry("to_muxed_id", muxedId)]),
        ),
      );
      assertEquals(transfer.hasMuxedId(), muxedId.type !== "scvVoid");
      assertEquals(mint.hasMuxedId(), muxedId.type !== "scvVoid");
    }
  });

  it("accepts maps without to_muxed_id and rejects invalid standardized data", () => {
    const withoutMuxed = TransferEvent.fromEvent(
      createEvent(transferTopics(), amountMap()),
    );
    const wrongAmount = createEvent(
      transferTopics(),
      xdr.ScVal.scvMap([
        symbolEntry("amount", xdr.ScVal.scvU32(100)),
      ]),
    );
    const wrongMuxed = createEvent(
      transferTopics(),
      amountMap(100n, [symbolEntry("to_muxed_id", xdr.ScVal.scvBool(true))]),
    );

    assertEquals(withoutMuxed.toMuxedId, undefined);
    assertEquals(withoutMuxed.hasMuxedId(), false);
    assertEquals(TransferEvent.is(wrongAmount), false);
    assertEquals(TransferEvent.is(wrongMuxed), false);
  });

  it("requires symbol keys while tolerating unknown symbol-keyed fields", () => {
    const invalid = createEvent(
      transferTopics(),
      xdr.ScVal.scvMap([
        entry(
          xdr.ScVal.scvString("amount"),
          nativeToScVal(100n, { type: "i128" }),
        ),
      ]),
    );
    const valid = createEvent(
      amountTopics("burn"),
      amountMap(100n, [symbolEntry("custom", xdr.ScVal.scvBool(true))]),
    );
    const recordThatIsNotAMap = createEvent(
      transferTopics(),
      xdr.ScVal.scvLedgerKeyContractInstance(),
    );
    const emptyMap = createEvent(transferTopics(), xdr.ScVal.scvMap(null));

    assertEquals(TransferEvent.is(invalid), false);
    assertEquals(TransferEvent.is(recordThatIsNotAMap), false);
    assertEquals(TransferEvent.is(emptyMap), false);
    assertEquals(BurnEvent.is(valid), true);
  });

  it("decodes application extensions into an explicitly validated type", () => {
    const transfer = TransferEvent.fromEvent(
      createEvent(
        transferTopics(),
        amountMap(100n, [symbolEntry("reference", xdr.ScVal.scvString("abc"))]),
      ),
    );

    const decoded = transfer.decodeExtensions((extensions) => ({
      reference: String(extensions.reference),
    }));
    assertEquals(decoded, { reference: "abc" });
  });

  it("wraps each application decoder failure in an occurrence-specific error", () => {
    const cases = [
      {
        event: TransferEvent.fromEvent(
          createEvent(
            transferTopics(),
            amountMap(100n, [symbolEntry("x", xdr.ScVal.scvBool(true))]),
          ),
        ),
        error: E.TRANSFER_EXTENSION_DECODER_FAILED,
      },
      {
        event: ApproveEvent.fromEvent(
          createEvent(
            approveTopics(),
            xdr.ScVal.scvMap([
              symbolEntry("amount", nativeToScVal(1n, { type: "i128" })),
              symbolEntry("live_until_ledger", xdr.ScVal.scvU32(2)),
              symbolEntry("x", xdr.ScVal.scvBool(true)),
            ]),
          ),
        ),
        error: E.APPROVE_EXTENSION_DECODER_FAILED,
      },
      {
        event: BurnEvent.fromEvent(
          createEvent(
            amountTopics("burn"),
            amountMap(100n, [symbolEntry("x", xdr.ScVal.scvBool(true))]),
          ),
        ),
        error: E.BURN_EXTENSION_DECODER_FAILED,
      },
      {
        event: MintEvent.fromEvent(
          createEvent(
            [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
            amountMap(100n, [symbolEntry("x", xdr.ScVal.scvBool(true))]),
          ),
        ),
        error: E.MINT_EXTENSION_DECODER_FAILED,
      },
      {
        event: ClawbackEvent.fromEvent(
          createEvent(
            amountTopics("clawback"),
            amountMap(100n, [symbolEntry("x", xdr.ScVal.scvBool(true))]),
          ),
        ),
        error: E.CLAWBACK_EXTENSION_DECODER_FAILED,
      },
    ];

    for (const [index, current] of cases.entries()) {
      const error = assertThrows(() =>
        current.event.decodeExtensions(() => {
          if (index === 0) throw "invalid";
          throw new Error("invalid");
        })
      );
      assertInstanceOf(error, current.error);
      assertEquals(error.meta?.data, {
        eventName: current.event.topics[0],
        extensionKeys: ["x"],
      });
      assertInstanceOf(error.meta?.cause, Error);
    }
  });
});
