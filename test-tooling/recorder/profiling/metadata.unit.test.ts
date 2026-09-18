import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Address, Operation, xdr } from "stellar-sdk";
import { Collector } from "@/recorder/runtime/collector.ts";
import {
  confirmed,
  failed,
  operations,
  simulation,
} from "@/recorder/profiling/extract.ts";
import {
  confirmedEvents,
  simulationEvents,
} from "@/recorder/profiling/events.ts";
import {
  confirmedChanges,
  simulationChanges,
} from "@/recorder/profiling/ledger-changes.ts";
import type { ExecutionEvidence } from "@/recorder/types.ts";
const { describe, it } = recordColibriTests(import.meta.url);
const full = () =>
  new Collector({
    capture: "details",
    events: "full",
    profiling: { resources: true, fees: true },
  });
const execution = (): ExecutionEvidence => ({
  kind: "invoke",
  operations: [],
  chain: "not-submitted",
  stages: [],
  simulations: [],
});
const zero = new Uint8Array(32);
const event = (
  type = xdr.ContractEventType.contract,
  contractId: xdr.ContractId | null = new xdr.ContractId(zero),
) =>
  new xdr.ContractEvent({
    ext: xdr.ExtensionPoint.v0(),
    contractId,
    type,
    body: xdr.ContractEventBody.v0(
      new xdr.ContractEventV0({
        topics: [xdr.ScVal.scvSymbol("transfer")],
        data: xdr.ScVal.scvI128(
          new xdr.Int128Parts({ hi: 0n, lo: 9007199254740993n }),
        ),
      }),
    ),
  });
const diagnostic = (ev = event(), successful = true) =>
  new xdr.DiagnosticEvent({ event: ev, inSuccessfulContractCall: successful });
const fees = () =>
  xdr.SorobanTransactionMetaExt.v1(
    new xdr.SorobanTransactionMetaExtV1({
      ext: xdr.ExtensionPoint.v0(),
      totalNonRefundableResourceFeeCharged: 100n,
      totalRefundableResourceFeeCharged: 9007199254740999n,
      rentFeeCharged: 9007199254740993n,
    }),
  );
const meta3 = (sorobanMeta: xdr.SorobanTransactionMeta | null) =>
  xdr.TransactionMeta.v3(
    new xdr.TransactionMetaV3({
      ext: xdr.ExtensionPoint.v0(),
      txChangesBefore: [],
      txChangesAfter: [],
      operations: [],
      sorobanMeta,
    }),
  );
const legacy = () =>
  meta3(
    new xdr.SorobanTransactionMeta({
      ext: fees(),
      events: [event()],
      returnValue: xdr.ScVal.scvVoid(),
      diagnosticEvents: [
        diagnostic(),
        diagnostic(event(xdr.ContractEventType.diagnostic, null)),
        diagnostic(event(), false),
      ],
    }),
  );
const ttl = (liveUntilLedgerSeq: number, byte = 0) =>
  new xdr.LedgerEntry({
    lastModifiedLedgerSeq: 100,
    ext: xdr.LedgerEntryExt.v0(),
    data: xdr.LedgerEntryData.ttl(
      new xdr.TtlEntry({
        keyHash: new xdr.Hash(new Uint8Array(32).fill(byte)),
        liveUntilLedgerSeq,
      }),
    ),
  });
const key = () =>
  xdr.LedgerKey.ttl(new xdr.LedgerKeyTtl({ keyHash: new xdr.Hash(zero) }));
const changes = () => [
  xdr.LedgerEntryChange.ledgerEntryState(ttl(100)),
  xdr.LedgerEntryChange.ledgerEntryUpdated(ttl(150)),
  xdr.LedgerEntryChange.ledgerEntryUpdated(ttl(150)),
  xdr.LedgerEntryChange.ledgerEntryUpdated(ttl(200, 1)),
  xdr.LedgerEntryChange.ledgerEntryCreated(ttl(300, 2)),
  xdr.LedgerEntryChange.ledgerEntryRestored(ttl(300, 3)),
  xdr.LedgerEntryChange.ledgerEntryRemoved(key()),
];
const modern = () =>
  xdr.TransactionMeta.v4(
    new xdr.TransactionMetaV4({
      ext: xdr.ExtensionPoint.v0(),
      txChangesBefore: [xdr.LedgerEntryChange.ledgerEntryCreated(ttl(999))],
      txChangesAfter: [],
      operations: [
        new xdr.OperationMetaV2({
          ext: xdr.ExtensionPoint.v0(),
          changes: changes(),
          events: [event(), event()],
        }),
      ],
      sorobanMeta: new xdr.SorobanTransactionMetaV2({
        ext: fees(),
        returnValue: null,
      }),
      events: [
        new xdr.TransactionEvent({
          stage: xdr.TransactionEventStage.transactionEventStageBeforeAllTxs,
          event: event(xdr.ContractEventType.system, null),
        }),
      ],
      diagnosticEvents: [
        diagnostic(),
        diagnostic(event(xdr.ContractEventType.diagnostic, null)),
      ],
    }),
  );

describe("transaction metadata evidence", () => {
  it("separates confirmed events from diagnostics across v3 and v4 without double counting", () => {
    const old = confirmedEvents(legacy(), full())!;
    assertEquals([
      old.count,
      old.contractCount,
      old.systemCount,
      old.diagnosticCount,
    ], [1, 1, 0, 2]);
    assertStringIncludes(JSON.stringify(old.items), "transfer");
    assertStringIncludes(JSON.stringify(old.items), "9007199254740993");
    const current = confirmedEvents(modern(), full())!;
    assertEquals([
      current.count,
      current.contractCount,
      current.systemCount,
      current.diagnosticCount,
    ], [3, 2, 1, 1]);
    assertStringIncludes(JSON.stringify(current.items), '"operationIndex":0');
    assertStringIncludes(
      JSON.stringify(current.items),
      '"source":"transaction"',
    );
    assertEquals(confirmedEvents(meta3(null), full()), undefined);
    assertEquals(
      confirmedEvents(xdr.TransactionMeta.operations([]), full()),
      undefined,
    );
    assertEquals(
      confirmedEvents(modern(), new Collector({ events: "none" })),
      undefined,
    );
  });
  it("retains counts with bounded or sanitized payloads and distinguishes missing from zero", () => {
    const limited = new Collector({ events: "full", limits: { entries: 1 } });
    const bounded = confirmedEvents(modern(), limited)!;
    assertEquals(bounded.count, 3);
    assertEquals(bounded.omitted, 3);
    assertEquals((bounded.items as unknown[]).length, 1);
    const summary = confirmedEvents(modern(), new Collector())!;
    assertEquals(summary.items, undefined);
    assertEquals(summary.omitted, 4);
    assertEquals(
      confirmedEvents(
        modern(),
        new Collector({ events: "full", sanitize: () => "hidden" }),
      )!.items,
      "hidden",
    );
    assertEquals(simulationEvents(undefined, full()), undefined);
    const empty = simulationEvents([], full())!;
    assertEquals(empty.count, 0);
    assertEquals(empty.items, []);
    const sim = simulationEvents([
      {},
      diagnostic(),
      diagnostic(event(xdr.ContractEventType.system)),
      diagnostic(event(), false),
    ], full())!;
    assertEquals([sim.count, sim.systemCount, sim.diagnosticCount], [2, 1, 1]);
    const failedSim = simulation(
      { events: [diagnostic(event(), false)] },
      "simulate-transaction",
      full(),
    )!;
    assertEquals(failedSim.events!.diagnosticCount, 1);
    assertEquals(failedSim.instructions, undefined);
  });
  it("counts operation mutations, known TTL extensions and changes before/after operations", () => {
    const result = confirmedChanges(modern(), full())!;
    assertEquals({ ...result, items: undefined }, {
      created: 2,
      updated: 3,
      removed: 1,
      restored: 1,
      ttlExtended: 1,
      ttlUnknown: 1,
      items: undefined,
    });
    assertStringIncludes(JSON.stringify(result.items), '"ttlBefore":100');
    assertStringIncludes(JSON.stringify(result.items), '"ttlAfter":150');
    assertEquals(confirmedChanges(modern(), new Collector()), undefined);
    assertEquals(
      confirmedChanges(xdr.TransactionMeta.operations([]), full())!.created,
      0,
    );
    const v1 = xdr.TransactionMeta.v1(
      new xdr.TransactionMetaV1({
        txChanges: [xdr.LedgerEntryChange.ledgerEntryCreated(ttl(50))],
        operations: [],
      }),
    );
    assertEquals(confirmedChanges(v1, full())!.created, 1);
    const v2 = xdr.TransactionMeta.v2(
      new xdr.TransactionMetaV2({
        txChangesBefore: [xdr.LedgerEntryChange.ledgerEntryState(ttl(50))],
        operations: [],
        txChangesAfter: [xdr.LedgerEntryChange.ledgerEntryUpdated(ttl(150))],
      }),
    );
    assertEquals(confirmedChanges(v2, full())!.ttlExtended, 1);
    assertStringIncludes(
      JSON.stringify(confirmedChanges(v2, full())!.items),
      '"phase":"after"',
    );
    assertEquals(simulationChanges(undefined, full()), undefined);
    const profile = simulation(
      { stateChanges: [{ before: ttl(100), after: ttl(250) }] },
      "simulate",
      full(),
    )!;
    assertEquals(profile.ledgerChanges!.ttlExtended, 1);
    const simulated = simulationChanges([
      { before: ttl(100), after: ttl(250) },
      { before: null, after: ttl(300) },
      { before: ttl(100), after: null },
      {},
    ], full())!;
    assertEquals([
      simulated.created,
      simulated.updated,
      simulated.removed,
      simulated.ttlExtended,
    ], [1, 1, 1, 1]);
    const limited = confirmedChanges(
      modern(),
      new Collector({
        capture: "trace",
        limits: { entries: 1 },
        profiling: { resources: true },
      }),
    )!;
    assertEquals((limited.items as unknown[]).length, 1);
    assertEquals(limited.updated, 3);
    assertEquals(
      confirmedChanges(
        modern(),
        new Collector({ profiling: { resources: true } }),
      )!.items,
      undefined,
    );
  });
  it("keeps exact confirmed rent and collects failed metadata even with fees disabled", () => {
    const e = execution();
    confirmed(
      { response: { status: "SUCCESS", resultMetaXdr: modern() } },
      e,
      full(),
    );
    assertEquals(e.events!.count, 3);
    assertEquals(
      (e.resourceFees as Record<string, unknown>).rentFeeCharged,
      "9007199254740993",
    );
    assertEquals(e.ledgerChanges!.ttlExtended, 1);
    const failedMeta = meta3(
      new xdr.SorobanTransactionMeta({
        ext: xdr.SorobanTransactionMetaExt.v0(),
        events: [],
        returnValue: xdr.ScVal.scvVoid(),
        diagnosticEvents: [diagnostic(event(), false)],
      }),
    );
    failed(
      {
        code: "STX_010",
        source: "@colibri/core/processes/send-transaction",
        meta: { data: { resultMetaXDR: failedMeta.toXdr("base64") } },
      },
      e,
      new Collector({ events: "full" }),
    );
    assertEquals(e.chain, "confirmed-failed");
    assertEquals(e.events!.count, 0);
    assertEquals(e.events!.diagnosticCount, 1);
    assertEquals(e.ledgerChanges, undefined);
  });
  it("identifies methods, uploads, deployment variants, restores and TTL targets", () => {
    const e = execution(), c = full();
    operations(e, {
      operations: [
        Operation.invokeContractFunction({
          contract: Address.contract(zero).toString(),
          function: "transfer",
          args: [],
        }),
        Operation.uploadContractWasm({ wasm: new Uint8Array([1, 2]) }),
        Operation.restoreFootprint({}),
        Operation.extendFootprintTtl({ extendTo: 1000 }),
      ],
    }, c);
    assertEquals(e.operationDetails!.map((op) => op.type), [
      "invokeHostFunction",
      "invokeHostFunction",
      "restoreFootprint",
      "extendFootprintTtl",
    ]);
    assertEquals(e.operationDetails![0].method, "transfer");
    assertEquals(
      e.operationDetails![1].hostFunction,
      "hostFunctionTypeUploadContractWasm",
    );
    assertEquals(e.operationDetails![3].extendTo, 1000);
    const preimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new xdr.ContractIdPreimageFromAddress({
        address: Address.contract(zero).toScAddress(),
        salt: zero,
      }),
    );
    const executable = xdr.ContractExecutable.contractExecutableWasm(
      new xdr.Hash(zero),
    );
    operations(e, {
      operations: [
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeCreateContract(
            new xdr.CreateContractArgs({
              contractIdPreimage: preimage,
              executable,
            }),
          ),
          auth: [],
        }),
        Operation.invokeHostFunction({
          func: xdr.HostFunction.hostFunctionTypeCreateContractV2(
            new xdr.CreateContractArgsV2({
              contractIdPreimage: preimage,
              executable,
              constructorArgs: [],
            }),
          ),
          auth: [],
        }),
      ],
    }, c);
    assertEquals(e.operationDetails!.map((op) => op.hostFunction), [
      "hostFunctionTypeCreateContract",
      "hostFunctionTypeCreateContractV2",
    ]);
    assertExists(e.operationDetails);
  });
});
