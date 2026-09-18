import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import {
  Account,
  Address,
  Keypair,
  SorobanDataBuilder,
  type Transaction,
  xdr,
} from "stellar-sdk";
import { type Api, Server } from "stellar-sdk/rpc";
import { Spec } from "stellar-sdk/contract";
import {
  Contract,
  type ContractId,
  createClassicTransactionPipeline,
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Operation } from "stellar-sdk";
import { ExecutionRecorder } from "@/recorder/index.ts";

const contractId = Address.contract(new Uint8Array(32))
  .toString() as ContractId;
const networkConfig = NetworkConfig.TestNet();
function metadata(): xdr.TransactionMeta {
  return xdr.TransactionMeta.v4(
    new xdr.TransactionMetaV4({
      ext: xdr.ExtensionPoint.v0(),
      txChangesBefore: [],
      txChangesAfter: [],
      operations: [],
      events: [],
      diagnosticEvents: [],
      sorobanMeta: new xdr.SorobanTransactionMetaV2({
        returnValue: xdr.ScVal.scvU32(7),
        ext: xdr.SorobanTransactionMetaExt.v1(
          new xdr.SorobanTransactionMetaExtV1({
            ext: xdr.ExtensionPoint.v0(),
            totalNonRefundableResourceFeeCharged: 100n,
            totalRefundableResourceFeeCharged: 20n,
            rentFeeCharged: 5n,
          }),
        ),
      }),
    }),
  );
}

describe("actual Colibri clients and transactions", () => {
  it("automatically attaches a real client and captures its decoded caller result", async () => {
    const rpc = new Server("https://rpc.example.org");
    const response = {
      _parsed: true,
      id: "sim",
      latestLedger: 100,
      events: [],
      transactionData: new SorobanDataBuilder(),
      minResourceFee: "100",
      result: { auth: [], retval: xdr.ScVal.scvU32(7) },
    } satisfies Api.SimulateTransactionSuccessResponse;
    using simulate = stub(
      rpc,
      "simulateTransaction",
      () => Promise.resolve(response),
    );
    const spec = new Spec([
      xdr.ScSpecEntry.scSpecEntryFunctionV0(
        new xdr.ScSpecFunctionV0({
          doc: "",
          name: "balance",
          inputs: [],
          outputs: [xdr.ScSpecTypeDef.scSpecTypeU32()],
        }),
      ),
    ]);
    const recorder = new ExecutionRecorder({ capture: "details" });
    const observer = recorder.observer("token.test.ts");
    const client = observer.create(() =>
      new Contract({ networkConfig, rpc, contractConfig: { contractId, spec } })
    );
    assertStrictEquals(observer.attach(client), client);
    assertEquals(
      await observer.capture(() => client.read({ method: "balance" })),
      7,
    );
    const records = recorder.report().records;
    assertEquals(records.filter((r) => r.execution).length, 1);
    assertEquals(
      records.find((r) => r.execution)?.execution?.network,
      networkConfig.networkPassphrase,
    );
    assertEquals(simulate.calls.length, 1);
  });
  for (const kind of ["classic", "invoke"] as const) {
    it(`profiles a complete ${kind} pipeline through signing and RPC confirmation`, async () => {
      const rpc = new Server("https://rpc.example.org");
      const keypair = Keypair.random();
      const signer = LocalSigner.fromKeypair(keypair, true);
      using ledger = stub(
        rpc,
        "getLatestLedger",
        () =>
          Promise.resolve(
            {
              id: "ledger",
              sequence: 100,
              protocolVersion: "25",
            } as Api.GetLatestLedgerResponse,
          ),
      );
      let sent: Transaction;
      let fail = false;
      using account = stub(
        rpc,
        "getAccount",
        () => Promise.resolve(new Account(keypair.publicKey(), "0")),
      );
      using simulation = stub(
        rpc,
        "simulateTransaction",
        () =>
          Promise.resolve(
            {
              _parsed: true,
              id: "sim",
              latestLedger: 100,
              events: [],
              transactionData: new SorobanDataBuilder().setResources(
                1000,
                100,
                10,
              ).setResourceFee(120),
              minResourceFee: "120",
              result: { auth: [], retval: xdr.ScVal.scvU32(7) },
            } satisfies Api.SimulateTransactionSuccessResponse,
          ),
      );
      using send = stub(rpc, "sendTransaction", (tx) => {
        sent = tx as Transaction;
        return Promise.resolve(
          {
            status: "PENDING",
            hash: xdr.encodeBytes(tx.hash(), "hex"),
            latestLedger: 100,
            latestLedgerCloseTime: 100,
          } as Api.SendTransactionResponse,
        );
      });
      using confirm = stub(rpc, "getTransaction", () =>
        Promise.resolve({
          status: fail ? "FAILED" : "SUCCESS",
          txHash: xdr.encodeBytes(sent.hash(), "hex"),
          ledger: 101,
          createdAt: 100,
          returnValue: xdr.ScVal.scvU32(7),
          envelopeXdr: sent.toEnvelope(),
          resultXdr: new xdr.TransactionResult({
            feeCharged: 220n,
            result: fail
              ? xdr.TransactionResultResult.txFailed([])
              : xdr.TransactionResultResult.txSuccess([
                xdr.OperationResult.opInner(
                  xdr.OperationResultTr.setOptions(
                    xdr.SetOptionsResult.setOptionsSuccess(),
                  ),
                ),
              ]),
            ext: xdr.TransactionResultExt.v0(),
          }),
          resultMetaXdr: metadata(),
          diagnosticEventsXdr: [],
        } as unknown as Api.GetTransactionResponse));
      const recorder = new ExecutionRecorder({
        capture: "trace",
        authorization: { level: "full" },
        profiling: { timings: true, resources: true, fees: true },
      });
      const pipeline = kind === "classic"
        ? createClassicTransactionPipeline({ networkConfig, rpc })
        : createInvokeContractPipeline({ networkConfig, rpc });
      recorder.observer().attach(pipeline, {
        name: "client",
        network: networkConfig,
      });
      const args = {
        operations: [
          kind === "classic"
            ? Operation.setOptions({})
            : Operation.invokeContractFunction({
              contract: contractId,
              function: "balance",
              args: [],
            }),
        ],
        config: {
          source: signer.publicKey(),
          fee: "100" as const,
          timeout: 30,
          signers: [signer],
        },
      };
      const output = await pipeline(args);
      assertEquals(output.hash, xdr.encodeBytes(sent!.hash(), "hex"));
      const record = recorder.report().records[0];
      assertEquals(record.status, "passed");
      assertEquals(record.execution?.kind, kind);
      assertEquals(record.execution?.chain, "confirmed-success");
      assertEquals(record.execution?.feeCharged, "220");
      assertEquals(record.execution?.resourceFees, {
        totalNonRefundableResourceFeeCharged: "100",
        totalRefundableResourceFeeCharged: "20",
        rentFeeCharged: "5",
      });
      assertEquals(simulation.calls.length, kind === "invoke" ? 1 : 0);
      assertEquals(
        record.execution?.simulations.length,
        kind === "invoke" ? 1 : 0,
      );
      assertEquals(ledger.calls.length, kind === "invoke" ? 1 : 0);
      assertEquals(send.calls.length, 1);
      assertEquals(confirm.calls.length, 1);
      assertEquals(account.calls.length, 1);
      assert(!JSON.stringify(record).includes(keypair.secret()));
      fail = true;
      await assertRejects(() => pipeline(args));
      const failure = recorder.report().records[1];
      assertEquals(failure.execution?.chain, "confirmed-failed");
      assertEquals(failure.status, "failed");
    });
  }
});
