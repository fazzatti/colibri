import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  Account,
  Operation,
  SorobanDataBuilder,
  type Transaction,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";
import { parseTransactionFailure } from "@/common/helpers/xdr/transaction-failure.ts";
import {
  ERROR_STATUS,
  TRANSACTION_FAILED,
} from "@/processes/send-transaction/error.ts";
import { NetworkConfig } from "@/network/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
const network = NetworkConfig.TestNet();
const transaction = (soroban = true) => {
  const builder = new TransactionBuilder(new Account(source, "100"), {
    fee: "100",
    networkPassphrase: network.networkPassphrase,
  }).addOperation(
    Operation.invokeContractFunction({
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      function: "test",
      args: [],
    }),
  ).setTimeout(0);
  if (soroban) {
    builder.setSorobanData(
      new SorobanDataBuilder().setResources(9_000_000, 100, 1616)
        .setResourceFee(29390).build(),
    );
  }
  return builder.build();
};
const result = (
  operation = xdr.OperationResult.opInner(
    xdr.OperationResultTr.invokeHostFunction(
      xdr.InvokeHostFunctionResult.invokeHostFunctionResourceLimitExceeded(),
    ),
  ),
) =>
  new xdr.TransactionResult({
    feeCharged: 100n,
    result: xdr.TransactionResultResult.txFailed([operation]),
    ext: xdr.TransactionResultExt.v0(),
  });
const metric = (
  name: string,
  value: xdr.ScVal = xdr.ScVal.scvU64(1664n),
  contractId: xdr.ContractId | null = null,
  type = xdr.ContractEventType.diagnostic,
) =>
  new xdr.DiagnosticEvent({
    inSuccessfulContractCall: false,
    event: new xdr.ContractEvent({
      ext: xdr.ExtensionPoint.v0(),
      contractId,
      type,
      body: xdr.ContractEventBody.v0(
        new xdr.ContractEventV0({
          topics: [
            xdr.ScVal.scvSymbol("core_metrics"),
            xdr.ScVal.scvSymbol(name),
          ],
          data: value,
        }),
      ),
    }),
  });

describe("transaction failure details", () => {
  it("extracts Soroban operation codes, observed overruns and declared fees", () => {
    const details = parseTransactionFailure({
      transaction: transaction(),
      result: result(),
      diagnosticEvents: [
        metric("ledger_write_byte"),
        metric("cpu_insn", xdr.ScVal.scvU64(9_100_000n)),
        metric("ledger_read_byte", xdr.ScVal.scvU64(80n)),
      ],
    });
    assertEquals(details.transactionCode, "txFailed");
    assertEquals(details.operations, [{
      index: 0,
      type: "invokeHostFunction",
      code: "invokeHostFunctionResourceLimitExceeded",
    }]);
    assertEquals(details.resources?.writeBytes, {
      declared: 1616,
      used: "1664",
      exceededBy: "48",
    });
    assertEquals(details.resources?.instructions, {
      declared: 9_000_000,
      used: "9100000",
      exceededBy: "100000",
    });
    assertEquals(details.resources?.diskReadBytes, {
      declared: 100,
      used: "80",
      exceededBy: "0",
    });
    assertEquals(details.fees, {
      declaredTotalFee: "29490",
      declaredResourceFee: "29390",
      declaredInclusionFee: "100",
      chargedFee: "100",
    });
  });

  it("distinguishes all resource/fee failure codes without inventing an exact deficit", () => {
    for (
      const failure of [
        xdr.InvokeHostFunctionResult.invokeHostFunctionMalformed(),
        xdr.InvokeHostFunctionResult.invokeHostFunctionEntryArchived(),
        xdr.InvokeHostFunctionResult
          .invokeHostFunctionInsufficientRefundableFee(),
      ]
    ) {
      const details = parseTransactionFailure({
        transaction: transaction(),
        result: result(
          xdr.OperationResult.opInner(
            xdr.OperationResultTr.invokeHostFunction(failure),
          ),
        ),
      });
      assertEquals(details.operations?.[0].code, failure.type);
      assertEquals(details.resources?.writeBytes, { declared: 1616 });
      assertEquals(details.fees?.refundableFeeCharged, undefined);
    }
  });

  it("unwraps fee-bump results and reports the outer bid and inner resource fee", () => {
    const tx = transaction();
    const bump = TransactionBuilder.buildFeeBumpTransaction(
      source,
      "200",
      tx,
      network.networkPassphrase,
    );
    const innerResult = new xdr.InnerTransactionResult({
      feeCharged: 100n,
      result: xdr.InnerTransactionResultResult.txFailed([
        xdr.OperationResult.opBadAuth(),
      ]),
      ext: xdr.InnerTransactionResultExt.v0(),
    });
    const outerResult = new xdr.TransactionResult({
      feeCharged: 200n,
      result: xdr.TransactionResultResult.txFeeBumpInnerFailed(
        new xdr.InnerTransactionResultPair({
          transactionHash: new Uint8Array(32),
          result: innerResult,
        }),
      ),
      ext: xdr.TransactionResultExt.v0(),
    });
    const details = parseTransactionFailure({
      transaction: bump,
      result: outerResult,
    });
    assertEquals(details.transactionCode, "txFeeBumpInnerFailed");
    assertEquals(details.innerTransactionCode, "txFailed");
    assertEquals(details.operations, [{ index: 0, code: "opBadAuth" }]);
    assertEquals(details.fees?.declaredTotalFee, bump.fee);
    assertEquals(details.fees?.declaredResourceFee, "29390");
  });

  it("reads charged fee components from supported metadata versions", () => {
    const ext = xdr.SorobanTransactionMetaExt.v1(
      new xdr.SorobanTransactionMetaExtV1({
        ext: xdr.ExtensionPoint.v0(),
        totalNonRefundableResourceFeeCharged: 100n,
        totalRefundableResourceFeeCharged: 200n,
        rentFeeCharged: 150n,
      }),
    );
    const v3 = xdr.TransactionMeta.v3(
      new xdr.TransactionMetaV3({
        ext: xdr.ExtensionPoint.v0(),
        txChangesBefore: [],
        operations: [],
        txChangesAfter: [],
        sorobanMeta: new xdr.SorobanTransactionMeta({
          ext,
          events: [],
          returnValue: xdr.ScVal.scvVoid(),
          diagnosticEvents: [],
        }),
      }),
    );
    const v4 = xdr.TransactionMeta.v4(
      new xdr.TransactionMetaV4({
        ext: xdr.ExtensionPoint.v0(),
        txChangesBefore: [],
        operations: [],
        txChangesAfter: [],
        sorobanMeta: new xdr.SorobanTransactionMetaV2({
          ext,
          returnValue: null,
        }),
        events: [],
        diagnosticEvents: [],
      }),
    );
    for (const resultMeta of [v3, v4]) {
      const fees =
        parseTransactionFailure({ transaction: transaction(), resultMeta })
          .fees;
      assertEquals(fees?.nonRefundableFeeCharged, "100");
      assertEquals(fees?.refundableFeeCharged, "200");
      assertEquals(fees?.rentFeeCharged, "150");
    }
    const older = xdr.TransactionMeta.operations([]);
    assertEquals(
      parseTransactionFailure({ transaction: transaction(), resultMeta: older })
        .fees?.rentFeeCharged,
      undefined,
    );
  });

  it("tolerates absent and malformed evidence without masking the primary failure", () => {
    assertEquals(
      parseTransactionFailure({
        transaction: {} as Transaction,
        result: {} as xdr.TransactionResult,
        resultMeta: {} as xdr.TransactionMeta,
        diagnosticEvents: [{} as xdr.DiagnosticEvent],
      }),
      { fees: {} },
    );
    const details = parseTransactionFailure({
      transaction: transaction(false),
      result: new xdr.TransactionResult({
        feeCharged: 0n,
        result: xdr.TransactionResultResult.txBadSeq(),
        ext: xdr.TransactionResultExt.v0(),
      }),
      diagnosticEvents: [metric("ledger_write_byte")],
    });
    assertEquals(details.resources, undefined);
    assertEquals(details.operations, undefined);
    assertEquals(details.fees?.declaredResourceFee, "0");
  });

  it("ignores contract-generated lookalikes, unknown metrics and malformed counter values", () => {
    const wrongTopics = new xdr.DiagnosticEvent({
      inSuccessfulContractCall: false,
      event: new xdr.ContractEvent({
        ext: xdr.ExtensionPoint.v0(),
        contractId: null,
        type: xdr.ContractEventType.diagnostic,
        body: xdr.ContractEventBody.v0(
          new xdr.ContractEventV0({
            topics: [xdr.ScVal.scvSymbol("other")],
            data: xdr.ScVal.scvU64(1n),
          }),
        ),
      }),
    });
    const details = parseTransactionFailure({
      transaction: transaction(),
      diagnosticEvents: [
        wrongTopics,
        metric("unknown"),
        metric("ledger_write_byte", xdr.ScVal.scvSymbol("invalid")),
        metric("ledger_write_byte", xdr.ScVal.scvI64(-1n)),
        metric(
          "ledger_write_byte",
          undefined,
          new xdr.ContractId(new Uint8Array(32)),
        ),
        metric(
          "ledger_write_byte",
          undefined,
          null,
          xdr.ContractEventType.contract,
        ),
      ],
    });
    assertEquals(details.resources?.writeBytes, { declared: 1616 });
  });

  it("enriches both existing error classes while retaining legacy data and raw evidence", () => {
    const tx = transaction();
    const failure = result();
    const diagnosticEvents = [metric("ledger_write_byte")];
    const input = { transaction: tx, rpc: {} as Server };
    const immediate = new ERROR_STATUS(
      input,
      "hash",
      failure,
      diagnosticEvents,
    );
    assertEquals(immediate.code, "STX_007");
    assertEquals(immediate.meta.data.errorResult, ["txFailed"]);
    assertEquals(immediate.meta.data.resultXDR, failure.toXdr("base64"));
    assertEquals(
      immediate.meta.data.failure?.resources?.writeBytes?.exceededBy,
      "48",
    );
    const terminal = new TRANSACTION_FAILED(
      input,
      "hash",
      {
        envelopeXdr: tx.toEnvelope(),
        resultXdr: failure,
        resultMetaXdr: xdr.TransactionMeta.operations([]),
        diagnosticEventsXdr: diagnosticEvents,
      } as Api.GetFailedTransactionResponse,
    );
    assertEquals(terminal.code, "STX_010");
    assertEquals(terminal.meta.data.resultXDR, failure.toXdr("base64"));
    assertEquals(
      terminal.meta.data.failure?.operations?.[0].code,
      "invokeHostFunctionResourceLimitExceeded",
    );
    assertEquals(
      new ERROR_STATUS(input, "hash").meta.data.resultXDR,
      undefined,
    );
    const malformed = new ERROR_STATUS(
      input,
      "hash",
      {} as xdr.TransactionResult,
      [{} as xdr.DiagnosticEvent],
    );
    assertEquals(malformed.code, "STX_007");
    assertEquals(malformed.meta.data.errorResult, null);
    assertEquals(malformed.meta.data.diagnosticEvents, null);
    const malformedContainer = new ERROR_STATUS(
      input,
      "hash",
      failure,
      {} as xdr.DiagnosticEvent[],
    );
    assertEquals(malformedContainer.code, "STX_007");
    assertEquals(
      malformedContainer.meta.data.failure?.operations?.[0].code,
      "invokeHostFunctionResourceLimitExceeded",
    );
  });
});
