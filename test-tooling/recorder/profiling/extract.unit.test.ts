import {
  assert,
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  Account,
  Address,
  Asset,
  Keypair,
  Networks,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { type Api, Server } from "stellar-sdk/rpc";
import { createReadFromContractPipeline, NetworkConfig } from "@colibri/core";
import { stub } from "@std/testing/mock";
import { ExecutionRecorder } from "@/recorder/index.ts";
import { Collector } from "@/recorder/runtime/collector.ts";
import {
  authorization,
  confirmed,
  failed,
  operations,
  result,
  simulation,
  submitted,
} from "@/recorder/profiling/extract.ts";
import type { ExecutionEvidence } from "@/recorder/types.ts";

const { describe, it } = recordColibriTests(import.meta.url);

const contract = Address.contract(new Uint8Array(32)).toString();
const execution = (): ExecutionEvidence => ({
  kind: "invoke",
  operations: [],
  chain: "not-submitted",
  stages: [],
  simulations: [],
});
const data = () =>
  new SorobanDataBuilder().setResources(1234, 500, 100).setResourceFee(120);

describe("Stellar evidence", () => {
  it("observes a real Colibri read pipeline and simulation budgets", async () => {
    const recorder = new ExecutionRecorder({
      capture: "details",
      authorization: { level: "summary" },
      profiling: { resources: true, fees: true, timings: true },
    });
    const rpc = new Server("https://rpc.example.org");
    const response: Api.SimulateTransactionSuccessResponse = {
      id: "1",
      latestLedger: 100,
      events: [],
      _parsed: true,
      transactionData: data(),
      minResourceFee: "120",
      result: { auth: [], retval: xdr.ScVal.scvU32(7) },
    };
    using simulate = stub(
      rpc,
      "simulateTransaction",
      () => Promise.resolve(response),
    );
    const pipeline = createReadFromContractPipeline({
      networkConfig: NetworkConfig.TestNet(),
      rpc,
    });
    recorder.observer().attach(pipeline, {
      name: "token",
      network: { networkPassphrase: Networks.TESTNET },
    });
    const value = await pipeline({
      operations: [
        Operation.invokeContractFunction({
          contract,
          function: "balance",
          args: [],
        }),
      ],
    });
    assertEquals(value, response.result!.retval);
    assertEquals(simulate.calls.length, 1);
    const record = recorder.report().records[0];
    assertEquals(record.name, "read balance");
    assertEquals(record.execution?.contract, contract);
    assertEquals(record.execution?.simulations[0].instructions, 1234);
    assertEquals(record.execution?.simulations[0].minResourceFee, "120");
    assertEquals(record.execution?.chain, "not-submitted");
    assertEquals(record.execution?.authorization, { entries: 0, types: [] });
  });
  it("distinguishes fee-bump hashes and does not retain envelope signatures", () => {
    const c = new Collector({ profiling: { fees: true, resources: true } });
    const e = execution();
    const source = Keypair.random();
    const tx = new TransactionBuilder(new Account(source.publicKey(), "0"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    }).addOperation(
      Operation.payment({
        destination: source.publicKey(),
        asset: Asset.native(),
        amount: "1",
      }),
    ).setTimeout(0).build();
    tx.sign(source);
    submitted({ transaction: tx }, e, c);
    const innerHash = e.hash;
    const bump = TransactionBuilder.buildFeeBumpTransaction(
      source,
      "200",
      tx,
      Networks.TESTNET,
    );
    bump.sign(source);
    submitted({ transaction: bump }, e, c);
    assertEquals(e.innerHash, innerHash);
    assert(e.hash !== innerHash);
    assertEquals(e.chain, "unknown");
    assert(!JSON.stringify(e.submitted).includes("signature"));
    assert(!JSON.stringify(e.submitted).includes(source.secret()));
    confirmed(
      {
        hash: e.hash,
        response: {
          status: "SUCCESS",
          resultXdr: new xdr.TransactionResult({
            feeCharged: 300n,
            result: xdr.TransactionResultResult.txSuccess([]),
            ext: xdr.TransactionResultExt.v0(),
          }),
        },
      },
      e,
      c,
    );
    assertEquals(e.chain, "confirmed-success");
    assertEquals(e.feeCharged, "300");
    confirmed({ response: { status: "FAILED" } }, e, c);
    assertEquals(e.chain, "confirmed-failed");
    submitted({}, e, c);
    assertEquals(e.innerHash, innerHash);
  });
  it("captures authorization trees with explicit signature opt-in", () => {
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(contract).toScAddress(),
          nonce: 5n,
          signatureExpirationLedger: 100,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: Address.fromString(contract).toScAddress(),
              functionName: "transfer",
              args: [],
            }),
          ),
        subInvocations: [],
      }),
    });
    assertEquals(authorization([entry], new Collector()), undefined);
    const details = authorization(
      [entry],
      new Collector({ authorization: { level: "full" } }),
    );
    assertStringIncludes(JSON.stringify(details), contract);
    assertStringIncludes(JSON.stringify(details), '"nonce":"5"');
    assert(!JSON.stringify(details).includes("encodedEntry"));
    assertStringIncludes(
      JSON.stringify(
        authorization(
          [entry],
          new Collector({ authorization: { level: "full", signatures: true } }),
        ),
      ),
      "encodedEntry",
    );
    assertEquals(
      authorization(null, new Collector({ authorization: { level: "full" } })),
      undefined,
    );
  });
  it("keeps unavailable measurements absent and restoration separate", () => {
    const c = new Collector();
    const e = execution();
    assertEquals(simulation({}, "simulate", c), undefined);
    assertEquals(operations(e, {}, c), undefined);
    assertEquals(result(3), 3);
    assertExists(result(xdr.ScVal.scvVoid()));
    assertEquals(simulation({ transactionData: data() }, "simulate", c), {
      stage: "simulate",
    });
    const profile = simulation(
      {
        transactionData: data(),
        minResourceFee: "120",
        restorePreamble: { transactionData: data(), minResourceFee: "900" },
      },
      "simulate",
      new Collector({ profiling: { resources: true, fees: true } }),
    );
    assertExists(profile?.restoration);
    operations(e, { operations: [{}, Operation.setOptions({})] }, c);
    assertEquals(e.operations, ["setOptions"]);
  });
  it("distinguishes timeouts from terminal failures and respects profiling flags", () => {
    const e = execution();
    e.chain = "unknown";
    failed(
      { code: "STX_011", source: "@colibri/core/processes/send-transaction" },
      e,
      new Collector(),
    );
    assertEquals(e.chain, "unknown");
    const error = {
      code: "STX_010",
      source: "@colibri/core/processes/send-transaction",
    };
    failed(error, e, new Collector());
    assertEquals(e.chain, "confirmed-failed");
    failed(error, e, new Collector({ profiling: { fees: true } }));
    assertEquals(e.feeCharged, undefined);
    for (const profiling of [{ fees: true }, { resources: true }]) {
      assertExists(
        simulation(
          {
            transactionData: data(),
            restorePreamble: { transactionData: data(), minResourceFee: "900" },
          },
          "simulate",
          new Collector({ profiling }),
        )?.restoration,
      );
    }
    const source = Keypair.random();
    const tx = new TransactionBuilder(new Account(source.publicKey(), "0"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    }).addOperation(Operation.setOptions({})).setTimeout(0).build();
    submitted({ transaction: tx }, e, new Collector());
    assertEquals((e.submitted as Record<string, unknown>).maxFee, null);
  });
});
