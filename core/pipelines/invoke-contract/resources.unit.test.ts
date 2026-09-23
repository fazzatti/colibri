import { assertEquals, assertRejects } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { calculateResourcePadding } from "@/resources/index.ts";
import {
  BUILD_TRANSACTION_STEP_ID,
  SIGN_AUTH_ENTRIES_STEP_ID,
  SIMULATE_TRANSACTION_STEP_ID,
} from "@/steps/index.ts";
import { createRunContext, step } from "convee";
import {
  Account,
  nativeToScVal,
  Networks,
  Operation,
  SorobanDataBuilder,
} from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { buildTransaction } from "@/processes/build-transaction/index.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import * as ERROR from "@/processes/assemble-transaction/error.ts";
import * as RESOURCE_ERROR from "@/resources/error.ts";
import {
  enforceSimulationToAssemble,
  inputToBuild,
  INVOKE_CONTRACT_INPUT_STEP_ID,
  signAuthEntriesToAssemble,
} from "@/pipelines/invoke-contract/connectors.ts";
import {
  getTransactionInclusionFee,
  getTransactionResourceFee,
} from "@/common/helpers/transaction-fee.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { InvokeContractInput } from "@/pipelines/invoke-contract/types.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import { createInvokeContractPipeline } from "@/pipelines/invoke-contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";

const { describe, it, observer: suiteObserver } = recordColibriTests(
  import.meta.url,
);

const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
const operation = Operation.invokeContractFunction({
  contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  function: "test",
  args: [],
});
const rpc = {
  getAccount: () => Promise.resolve(new Account(source, "100")),
} as unknown as Server;
const simulation = (fee: number): SimulateTransactionOutput => ({
  id: String(fee),
  latestLedger: 100,
  events: [],
  minResourceFee: String(fee),
  transactionData: new SorobanDataBuilder().setResources(1000, 1024, 1024)
    .setResourceFee(fee),
  result: { auth: [], retval: nativeToScVal(null) },
  _parsed: true,
});

async function assemblyInput(
  fee: TransactionConfig["fee"],
  resources: TransactionConfig["resources"],
  path: "ordinary" | "enforcing" = "enforcing",
) {
  const input: InvokeContractInput = {
    operations: [operation],
    config: {
      source,
      fee,
      timeout: 0,
      signers: [],
      ...(resources === undefined ? {} : { resources }),
    },
  };
  const transaction = await buildTransaction(
    inputToBuild(rpc, Networks.TESTNET)(input),
  );
  const recording = simulation(20000);
  const final = simulation(30000);
  const context = createRunContext();
  for (
    const [id, value] of [
      [INVOKE_CONTRACT_INPUT_STEP_ID, input],
      [BUILD_TRANSACTION_STEP_ID, transaction],
      [SIMULATE_TRANSACTION_STEP_ID, recording],
      [SIGN_AUTH_ENTRIES_STEP_ID, []],
    ] as const
  ) {
    await step(() => value, { id }).runWith({ context: { parent: context } });
  }
  const assembledInput = path === "ordinary"
    ? await signAuthEntriesToAssemble().runWith({
      context: { parent: context },
    })
    : await enforceSimulationToAssemble().runWith({
      context: { parent: context },
    }, final);
  return { assembledInput, recording, final };
}

const fees: {
  name: string;
  fee: TransactionConfig["fee"];
  inclusion?: bigint;
}[] = [
  { name: "string", fee: "100", inclusion: 100n },
  { name: "base", fee: { base: "200" }, inclusion: 200n },
  { name: "inclusion", fee: { inclusion: "300" }, inclusion: 300n },
  { name: "max", fee: { max: "50000" } },
];
const policies: {
  name: string;
  resources: TransactionConfig["resources"];
  expected: (base: bigint) => bigint;
}[] = [
  { name: "omitted", resources: undefined, expected: (base) => base },
  { name: "empty", resources: {}, expected: (base) => base },
  {
    name: "override",
    resources: { override: { resourceFee: "35000" } },
    expected: () => 35000n,
  },
  {
    name: "absolute-padding",
    resources: { padding: { resourceFee: { amount: "5000" } } },
    expected: (base) => base + 5000n,
  },
  {
    name: "percentage-padding",
    resources: { padding: { resourceFee: { percent: 10 } } },
    expected: (base) => base * 11n / 10n,
  },
  {
    name: "bytes-only",
    resources: { padding: { writeBytes: { amount: 10 } } },
    expected: (base) => base,
  },
  {
    name: "instructions-only",
    resources: { override: { instructions: 2000 } },
    expected: (base) => base,
  },
];
describe("invoke-contract resource and fee policies", () => {
  it("stops the invocation before submission when padding exceeds its maximum", async () => {
    let submissions = 0;
    const mockRpc = {
      getAccount: () => Promise.resolve(new Account(source, "100")),
      getLatestLedger: () => Promise.resolve({ sequence: 100 }),
      simulateTransaction: () => Promise.resolve(simulation(30000)),
      sendTransaction: () => {
        submissions++;
        return Promise.resolve({ status: "PENDING" });
      },
    } as unknown as Server;
    const invoke = suiteObserver.attach(
      createInvokeContractPipeline({
        networkConfig: NetworkConfig.TestNet(),
        rpc: mockRpc,
      }),
      { name: "invoke" },
    );

    await assertRejects(() =>
      invoke({
        operations: [operation],
        config: {
          source,
          timeout: 0,
          signers: [],
          fee: { max: "35099" },
          resources: { padding: { resourceFee: { amount: "5000" } } },
        },
      }), ERROR.MAX_FEE_TOO_LOW_ERROR);
    assertEquals(submissions, 0);
  });

  for (const path of ["ordinary", "enforcing"] as const) {
    for (const mode of fees) {
      for (const policy of policies) {
        it(`${path}/${mode.name}/${policy.name}`, async () => {
          const { assembledInput, recording, final } = await assemblyInput(
            mode.fee,
            policy.resources,
            path,
          );
          const transaction = await assembleTransaction(assembledInput);
          const resource = policy.expected(
            path === "ordinary" ? 20000n : 30000n,
          );
          const inclusion = mode.inclusion ?? (50000n - resource);
          assertEquals(getTransactionResourceFee(transaction), resource);
          assertEquals(getTransactionInclusionFee(transaction), inclusion);
          assertEquals(BigInt(transaction.fee), resource + inclusion);
          assertEquals(recording.transactionData.build().resourceFee, 20000n);
          assertEquals(final.transactionData.build().resourceFee, 30000n);
          assertEquals(transaction.tx.ext.type, "sorobanData");
          if (transaction.tx.ext.type === "sorobanData") {
            assertEquals(
              transaction.tx.ext.sorobanData.resources.writeBytes,
              policy.name === "bytes-only" ? 1034 : 1024,
            );
            assertEquals(
              transaction.tx.ext.sorobanData.resources.instructions,
              policy.name === "instructions-only" ? 2000 : 1000,
            );
          }
        });
      }
    }
  }

  for (
    const resources of [
      { override: { resourceFee: "35000" } },
      { padding: { resourceFee: { amount: "5000" } } },
    ] satisfies TransactionConfig["resources"][]
  ) {
    it(`max boundary ${JSON.stringify(resources)}`, async () => {
      const accepted = await assemblyInput({ max: "35100" }, resources);
      const tx = await assembleTransaction(accepted.assembledInput);
      assertEquals(tx.fee, "35100");
      assertEquals(getTransactionInclusionFee(tx), 100n);
      const rejected = await assemblyInput({ max: "35099" }, resources);
      await assertRejects(
        () => assembleTransaction(rejected.assembledInput),
        ERROR.MAX_FEE_TOO_LOW_ERROR,
      );
    });
  }
  it("percentage padding obeys the same max boundary", async () => {
    const resources = { padding: { resourceFee: { percent: 10 } } };
    const accepted = await assemblyInput({ max: "33100" }, resources);
    assertEquals(
      (await assembleTransaction(accepted.assembledInput)).fee,
      "33100",
    );
    const rejected = await assemblyInput({ max: "33099" }, resources);
    await assertRejects(
      () => assembleTransaction(rejected.assembledInput),
      ERROR.MAX_FEE_TOO_LOW_ERROR,
    );
  });
  it("larger envelope budget does not relax the resource override floor", async () => {
    const input = await assemblyInput({ max: "50000" }, {
      override: { resourceFee: "29999" },
    });
    await assertRejects(
      () => assembleTransaction(input.assembledInput),
      RESOURCE_ERROR.BELOW_RECOMMENDATION,
    );
  });
  it("combined fee overflow is rejected", async () => {
    const input = await assemblyInput("100", {
      override: { resourceFee: "4294967295" },
    });
    await assertRejects(
      () => assembleTransaction(input.assembledInput),
      ERROR.TRANSACTION_FEE_TOO_HIGH_ERROR,
    );
  });
  it("reassembly preserves the inclusion component without double charging", async () => {
    const input = await assemblyInput("100", {
      padding: { resourceFee: { amount: "5000" } },
    });
    const once = await assembleTransaction(input.assembledInput);
    const twice = await assembleTransaction({
      ...input.assembledInput,
      transaction: once,
    });
    assertEquals(once.fee, "35100");
    assertEquals(twice.fee, once.fee);
    assertEquals(getTransactionResourceFee(twice), 35000n);
  });

  for (const mode of fees) {
    it(`applies calculator output with the ${mode.name} fee strategy`, async () => {
      const finalSimulation = simulation(30000);
      const calculation = calculateResourcePadding({
        simulation: finalSimulation,
        settings: {
          networkPassphrase: Networks.TESTNET,
          protocolVersion: 27,
          latestLedger: 100,
          limits: {
            instructions: 100_000_000,
            diskReadBytes: 100_000,
            writeBytes: 100_000,
            memoryBytes: 40_000_000,
            footprintEntries: 100,
          },
          fees: {
            perInstructionIncrement: "100",
            perDiskRead1KB: "10",
            perWrite1KB: "1000",
          },
        },
        padding: {
          writeBytes: { amount: 10 },
          refundableFee: { amount: "5000" },
        },
      });
      // At 1000 stroops/KiB, 1024 -> 1034 bytes adds 10 after rounded-total
      // subtraction. Add 5000 refundable stroops once, independently of inclusion.
      assertEquals(calculation.padding.resourceFee, { amount: "5010" });
      const input = await assemblyInput(mode.fee, {
        padding: calculation.padding,
      });
      const tx = await assembleTransaction(input.assembledInput);
      assertEquals(getTransactionResourceFee(tx), 35010n);
      assertEquals(getTransactionInclusionFee(tx), mode.inclusion ?? 14990n);
      assertEquals(
        BigInt(tx.fee),
        mode.inclusion === undefined ? 50000n : 35010n + mode.inclusion,
      );
      assertEquals(finalSimulation.transactionData.build().resourceFee, 30000n);
    });
  }
});
