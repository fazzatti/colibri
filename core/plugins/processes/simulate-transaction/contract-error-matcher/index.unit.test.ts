import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { pipe, step } from "convee";
import {
  Account,
  Address,
  Operation,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";
import { Buffer } from "node:buffer";
import { NetworkConfig } from "@/network/index.ts";
import type { SimulateTransactionInput } from "@/processes/simulate-transaction/types.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import * as SIM_ERRORS from "@/processes/simulate-transaction/error.ts";
import { SIMULATE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";
import type {
  ParsedFailedSimulationResponse,
  ParsedSimulationContractErrorStackItem,
} from "@/common/helpers/contract-error-from-failed-simulation-response.ts";
import {
  CONTRACT_ERROR_MATCHER_PLUGIN_ID,
  CONTRACT_ERROR_MATCHER_PLUGIN_TARGET,
  createContractErrorMatcherPlugin,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import * as PLUGIN_ERRORS from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
import type { ContractId } from "@/strkeys/types.ts";

const ROOT_CONTRACT_ID = Address.contract(Buffer.alloc(32, 1))
  .toString() as ContractId;
const SUB_CONTRACT_ID = Address.contract(Buffer.alloc(32, 2))
  .toString() as ContractId;

const createTestTransaction = (): Transaction => {
  const account = new Account(
    "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
    "100",
  );

  return new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
  })
    .addOperation(Operation.setOptions({}))
    .setTimeout(300)
    .build();
};

const createInput = (): SimulateTransactionInput => ({
  transaction: createTestTransaction(),
  rpc: {} as Server,
});

const createErrorResponse = (
  code: number,
): Api.SimulateTransactionErrorResponse => ({
  id: "mock-id",
  latestLedger: 1000,
  events: [],
  error: `HostError: Error(Contract, #${code})`,
  _parsed: true,
});

const createStackItem = (
  overrides: Partial<ParsedSimulationContractErrorStackItem>,
): ParsedSimulationContractErrorStackItem => ({
  code: 265,
  contractId: ROOT_CONTRACT_ID,
  eventIndex: 1,
  inSuccessfulContractCall: false,
  issuedFrom: "root-invocation",
  data: ["failing with contract error", 265],
  ...overrides,
});

const createContractSimulationError = (
  stack: ParsedSimulationContractErrorStackItem[],
): SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED => {
  const surfaceCode = stack.at(-1)?.code ?? 265;
  const failedSimulation: ParsedFailedSimulationResponse & {
    contractError: NonNullable<ParsedFailedSimulationResponse["contractError"]>;
  } = {
    contractError: {
      kind: "contract",
      code: surfaceCode,
      source: "simulation-error-string",
      matchingEventIndexes: stack
        .filter((item) => item.code === surfaceCode)
        .map((item) => item.eventIndex),
    },
    diagnosticEvents: [],
    contractErrorStack: stack,
  };

  return new SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED(
    createInput(),
    createErrorResponse(surfaceCode),
    failedSimulation,
  );
};

const createFailingSimulationPipe = (error: Error) =>
  pipe([
    step(
      (_input: SimulateTransactionInput): SimulateTransactionOutput => {
        throw error;
      },
      { id: SIMULATE_TRANSACTION_STEP_ID },
    ),
  ], { id: "ContractErrorMatcherPluginTestPipe" as const });

describe("createContractErrorMatcherPlugin", () => {
  it("targets the simulate-transaction step with a stable plugin id", () => {
    const plugin = createContractErrorMatcherPlugin({
      265: { message: "Known token error" },
    });

    assertEquals(plugin.id, CONTRACT_ERROR_MATCHER_PLUGIN_ID);
    assertEquals(plugin.target, CONTRACT_ERROR_MATCHER_PLUGIN_TARGET);
    assertEquals(plugin.targets(SIMULATE_TRANSACTION_STEP_ID), true);
    assertEquals(plugin.supports("error"), true);
  });

  it("wraps a contract simulation error when a simple error-code map matches", async () => {
    const originalError = createContractSimulationError([
      createStackItem({ code: 265, eventIndex: 4 }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin({
        265: {
          message: "Known token error",
          details: "The known token error details from the contract spec.",
        },
      }),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(
      error.code,
      PLUGIN_ERRORS.Code.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
    );
    assertEquals(error.message, "Contract error: Known token error");
    assertEquals(error.meta.cause, originalError);
    assertEquals(error.meta.data.match.code, 265);
    assertEquals(error.meta.data.match.message, "Known token error");
    assertEquals(
      error.meta.data.match.details,
      "The known token error details from the contract spec.",
    );
    assertEquals(
      error.diagnostic?.rootCause,
      "The known token error details from the contract spec.",
    );
    assertEquals(error.meta.data.match.contractId, ROOT_CONTRACT_ID);
    assertEquals(error.meta.data.match.issuedFrom, "root-invocation");
    assertEquals(error.meta.data.match.eventIndex, 4);
    assertEquals(error.meta.data.match.strategy, "any");
    assertEquals(error.meta.data.match.matcherIndex, 0);
  });

  it("keeps the original contract simulation error when no configured code matches", async () => {
    const originalError = createContractSimulationError([
      createStackItem({ code: 265 }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin({
        3477: { message: "Different error" },
      }),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error, originalError);
    assertEquals(error.code, SIM_ERRORS.Code.CONTRACT_ERROR_SIMULATION_FAILED);
  });

  it("prefers the surfaced contract error when older stack entries also match", async () => {
    const originalError = createContractSimulationError([
      createStackItem({
        code: 1,
        contractId: SUB_CONTRACT_ID,
        issuedFrom: "sub-invocation",
        eventIndex: 2,
      }),
      createStackItem({
        code: 265,
        contractId: ROOT_CONTRACT_ID,
        issuedFrom: "root-invocation",
        eventIndex: 6,
      }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin({
        1: { message: "Older nested error" },
        265: { message: "Surfaced rethrow error" },
      }),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error.message, "Contract error: Surfaced rethrow error");
    assertEquals(error.meta.cause, originalError);
    assertEquals(error.meta.data.match.code, 265);
    assertEquals(error.meta.data.match.message, "Surfaced rethrow error");
    assertEquals(error.meta.data.match.details, undefined);
    assertEquals(error.meta.data.match.contractId, ROOT_CONTRACT_ID);
    assertEquals(error.meta.data.match.issuedFrom, "root-invocation");
    assertEquals(error.meta.data.match.eventIndex, 6);
    assertEquals(error.meta.data.match.strategy, "any");
    assertEquals(error.meta.data.match.matcherIndex, 0);
  });

  it("keeps the surfaced contract simulation error when only an older nested code is mapped", async () => {
    const originalError = createContractSimulationError([
      createStackItem({
        code: 1,
        contractId: SUB_CONTRACT_ID,
        issuedFrom: "sub-invocation",
        eventIndex: 2,
      }),
      createStackItem({
        code: 265,
        contractId: ROOT_CONTRACT_ID,
        issuedFrom: "root-invocation",
        eventIndex: 6,
      }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin({
        1: { message: "Older nested error" },
      }),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error, originalError);
    assertEquals(error.code, SIM_ERRORS.Code.CONTRACT_ERROR_SIMULATION_FAILED);
    assertEquals(error.meta.data.contractError.code, 265);
  });

  it("uses the first matching strategy entry before later, more specific entries", async () => {
    const originalError = createContractSimulationError([
      createStackItem({ code: 265, contractId: ROOT_CONTRACT_ID }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin([
        {
          strategy: "any",
          errors: {
            265: { message: "Generic known error" },
          },
        },
        {
          strategy: "contract-id",
          contractId: ROOT_CONTRACT_ID,
          errors: {
            265: { message: "Specific known error" },
          },
        },
      ]),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error.message, "Contract error: Generic known error");
    assertEquals(error.meta.cause, originalError);
    assertEquals(error.meta.data.match.code, 265);
    assertEquals(error.meta.data.match.message, "Generic known error");
    assertEquals(error.meta.data.match.details, undefined);
    assertEquals(
      error.diagnostic?.rootCause,
      "A contract-defined error was recognized by the contract-error matcher plugin.",
    );
    assertEquals(error.meta.data.match.strategy, "any");
    assertEquals(error.meta.data.match.matcherIndex, 0);
  });

  it("matches a configured contract id against the contract-error stack", async () => {
    const originalError = createContractSimulationError([
      createStackItem({
        code: 265,
        contractId: ROOT_CONTRACT_ID,
        issuedFrom: "root-invocation",
      }),
      createStackItem({
        code: 1,
        contractId: SUB_CONTRACT_ID,
        issuedFrom: "sub-invocation",
        eventIndex: 5,
      }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin([
        {
          strategy: "contract-id",
          contractId: SUB_CONTRACT_ID,
          errors: {
            1: { message: "Known sub-contract error" },
          },
        },
      ]),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error.message, "Contract error: Known sub-contract error");
    assertEquals(error.meta.cause, originalError);
    assertEquals(error.meta.data.match.code, 1);
    assertEquals(error.meta.data.match.message, "Known sub-contract error");
    assertEquals(error.meta.data.match.contractId, SUB_CONTRACT_ID);
    assertEquals(error.meta.data.match.issuedFrom, "sub-invocation");
    assertEquals(error.meta.data.match.eventIndex, 5);
    assertEquals(error.meta.data.match.strategy, "contract-id");
    assertEquals(error.meta.data.match.matcherIndex, 0);
  });

  it("keeps the surfaced contract simulation error when the configured contract id rejects the surfaced code", async () => {
    const originalError = createContractSimulationError([
      createStackItem({
        code: 265,
        contractId: ROOT_CONTRACT_ID,
        issuedFrom: "root-invocation",
        eventIndex: 7,
      }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin([
        {
          strategy: "contract-id",
          contractId: SUB_CONTRACT_ID,
          errors: {
            265: { message: "Known error for another contract" },
          },
        },
      ]),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      SIM_ERRORS.CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error, originalError);
    assertEquals(error.code, SIM_ERRORS.Code.CONTRACT_ERROR_SIMULATION_FAILED);
    assertEquals(error.meta.data.contractError.code, 265);
    assertEquals(error.meta.data.contractErrorStack[0].code, 265);
    assertEquals(
      error.meta.data.contractErrorStack[0].contractId,
      ROOT_CONTRACT_ID,
    );
  });

  it("matches the configured root or sub invocation issuer", async () => {
    const originalError = createContractSimulationError([
      createStackItem({
        code: 265,
        contractId: ROOT_CONTRACT_ID,
        issuedFrom: "root-invocation",
      }),
      createStackItem({
        code: 1,
        contractId: SUB_CONTRACT_ID,
        issuedFrom: "sub-invocation",
        eventIndex: 8,
      }),
    ]);
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin([
        {
          strategy: "issued-from",
          issuedFrom: "sub-invocation",
          errors: {
            1: { message: "Known nested error" },
          },
        },
      ]),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      PLUGIN_ERRORS.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
    );

    assertEquals(error.message, "Contract error: Known nested error");
    assertEquals(error.meta.cause, originalError);
    assertEquals(error.meta.data.match.code, 1);
    assertEquals(error.meta.data.match.message, "Known nested error");
    assertEquals(error.meta.data.match.contractId, SUB_CONTRACT_ID);
    assertEquals(error.meta.data.match.issuedFrom, "sub-invocation");
    assertEquals(error.meta.data.match.eventIndex, 8);
    assertEquals(error.meta.data.match.strategy, "issued-from");
    assertEquals(error.meta.data.match.matcherIndex, 0);
  });

  it("does not wrap non-contract simulation failures", async () => {
    const originalError = new Error("plain step failure");
    const testPipe = createFailingSimulationPipe(originalError);
    testPipe.use(
      createContractErrorMatcherPlugin({
        265: { message: "Known token error" },
      }),
    );

    const error = await assertRejects(
      async () => await testPipe(createInput()),
      Error,
    );

    assert(error === originalError);
    assertEquals(error.message, "plain step failure");
  });
});
