import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { createRunContext, step } from "convee";
import {
  Account,
  Address,
  buildWithDelegatesEntry,
  nativeToScVal,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { Buffer } from "node:buffer";
import {
  assembleForEnforcementToEnforceSimulation,
  enforceSimulationToAssemble,
  INVOKE_CONTRACT_INPUT_STEP_ID,
  signAuthEntriesToAssemble,
  signAuthEntriesToAssembleForEnforcement,
} from "@/pipelines/invoke-contract/connectors.ts";
import type { InvokeContractInput } from "@/pipelines/invoke-contract/types.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import {
  BUILD_TRANSACTION_STEP_ID,
  SIGN_AUTH_ENTRIES_STEP_ID,
  SIMULATE_TRANSACTION_STEP_ID,
} from "@/steps/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { operationHasDelegatedAuthorization } from "@/common/helpers/xdr/operation-has-delegated-authorization.ts";
import { EXPECTED_INVOKE_HOST_FUNCTION_OPERATION } from "@/pipelines/invoke-contract/error.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import { assembleForEnforcement } from "@/processes/assemble-for-enforcement/index.ts";
import {
  getTransactionInclusionFee,
  getTransactionResourceFee,
} from "@/common/helpers/transaction-fee.ts";

const { describe, it } = recordColibriTests(import.meta.url);

const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
const rootAddress = Address.contract(Buffer.alloc(32, 1));
const delegateAddress = Address.account(Buffer.alloc(32, 2));
const invokeArgs = new xdr.InvokeContractArgs({
  contractAddress: rootAddress.toScAddress(),
  functionName: "authorize",
  args: [],
});
const invocation = new xdr.SorobanAuthorizedInvocation({
  function: xdr.SorobanAuthorizedFunction
    .sorobanAuthorizedFunctionTypeContractFn(
      invokeArgs,
    ),
  subInvocations: [],
});
const entry = buildWithDelegatesEntry({
  entry: new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(
      new xdr.SorobanAddressCredentials({
        address: rootAddress.toScAddress(),
        nonce: xdr.Int64(1),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  }),
  validUntilLedgerSeq: 100,
  delegates: [{ address: delegateAddress.toString() }],
});
const transaction = new TransactionBuilder(new Account(source, "100"), {
  fee: "100",
  networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
})
  .addOperation(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs),
      auth: [],
    }),
  )
  .setTimeout(0)
  .build();

const simulation = (id: string): SimulateTransactionOutput => ({
  id,
  latestLedger: 100,
  events: [],
  minResourceFee: "42",
  transactionData: new SorobanDataBuilder(),
  result: { auth: [], retval: nativeToScVal(null) },
  _parsed: true,
});

const invokeInput: InvokeContractInput = {
  operations: [],
  config: {
    fee: { max: "500" },
    source,
    timeout: 30,
    signers: [],
  },
};
const invokeInputWithStringFee: InvokeContractInput = {
  ...invokeInput,
  config: { ...invokeInput.config, fee: "100" },
};

const seedStepOutput = async <Output>(
  context: ReturnType<typeof createRunContext>,
  stepId: string,
  output: Output,
) => {
  const seedStep = step(() => output, { id: stepId });
  await seedStep.runWith({ context: { parent: context } });
};

describe("invoke-contract enforcement connectors", () => {
  it("applies padding once to final enforcing data and never to preliminary assembly", async () => {
    const context = createRunContext();
    const recording = {
      ...simulation("recording"),
      transactionData: new SorobanDataBuilder().setResources(100, 0, 100)
        .setResourceFee(100),
    };
    const final = {
      ...simulation("enforcing"),
      transactionData: new SorobanDataBuilder().setResources(130, 0, 200)
        .setResourceFee(200),
    };
    const input: InvokeContractInput = {
      ...invokeInput,
      config: {
        ...invokeInput.config,
        resources: {
          padding: {
            instructions: { percent: 10 },
            writeBytes: { amount: 10 },
            resourceFee: { amount: "10" },
          },
        },
      },
    };
    await seedStepOutput(context, BUILD_TRANSACTION_STEP_ID, transaction);
    await seedStepOutput(context, SIMULATE_TRANSACTION_STEP_ID, recording);
    await seedStepOutput(context, SIGN_AUTH_ENTRIES_STEP_ID, [entry]);
    await seedStepOutput(context, INVOKE_CONTRACT_INPUT_STEP_ID, input);
    const preliminary = await signAuthEntriesToAssembleForEnforcement().runWith(
      { context: { parent: context } },
      entry,
    );
    assertEquals("resources" in preliminary, false);
    const intermediate = await assembleForEnforcement(preliminary);
    assertEquals(intermediate.fee, "500");
    assertEquals(getTransactionResourceFee(intermediate), 100n);
    assertEquals(getTransactionInclusionFee(intermediate), 400n);
    const ordinary = await signAuthEntriesToAssemble().runWith({
      context: { parent: context },
    }, entry);
    assertEquals(ordinary.resources, input.config.resources);
    const assembly = await enforceSimulationToAssemble().runWith({
      context: { parent: context },
    }, final);
    const assembled = await assembleTransaction(assembly);
    assertEquals(assembled.fee, "500");
    assertEquals(getTransactionInclusionFee(assembled), 290n);
    assertEquals(assembled.tx.ext.type, "sorobanData");
    if (assembled.tx.ext.type !== "sorobanData") return;
    assertEquals(assembled.tx.ext.sorobanData.resources.instructions, 143);
    assertEquals(assembled.tx.ext.sorobanData.resources.writeBytes, 210);
    assertEquals(assembled.tx.ext.sorobanData.resourceFee, 210n);
    assertEquals(final.transactionData.build().resources.instructions, 130);
    assertEquals(recording.transactionData.build().resources.instructions, 100);
  });
  it("builds enforcement assembly input from signed entries", async () => {
    const context = createRunContext();
    const recording = simulation("recording");
    await seedStepOutput(context, BUILD_TRANSACTION_STEP_ID, transaction);
    await seedStepOutput(context, SIMULATE_TRANSACTION_STEP_ID, recording);
    await seedStepOutput(
      context,
      INVOKE_CONTRACT_INPUT_STEP_ID,
      invokeInput,
    );

    const result = await signAuthEntriesToAssembleForEnforcement().runWith(
      { context: { parent: context } },
      entry,
    );

    assertStrictEquals(result.transaction, transaction);
    assertStrictEquals(result.sorobanData, recording.transactionData);
    assertEquals(result.transactionFee, { max: "500" });
    assertEquals(result.resourceFee, undefined);
    assertEquals(
      operationHasDelegatedAuthorization(result.authorizedOperation),
      true,
    );
  });

  it("omits an explicit enforcement strategy for a string fee", async () => {
    const context = createRunContext();
    const recording = simulation("recording");
    await seedStepOutput(context, BUILD_TRANSACTION_STEP_ID, transaction);
    await seedStepOutput(context, SIMULATE_TRANSACTION_STEP_ID, recording);
    await seedStepOutput(
      context,
      INVOKE_CONTRACT_INPUT_STEP_ID,
      invokeInputWithStringFee,
    );

    const result = await signAuthEntriesToAssembleForEnforcement().runWith(
      { context: { parent: context } },
      entry,
    );

    assertEquals(result.transactionFee, undefined);
  });

  it("rejects a non-invoke operation with a typed pipeline error", async () => {
    const context = createRunContext();
    const classicTransaction = new TransactionBuilder(
      new Account(source, "100"),
      {
        fee: "100",
        networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      },
    )
      .addOperation(Operation.setOptions({}))
      .setTimeout(0)
      .build();
    await seedStepOutput(
      context,
      BUILD_TRANSACTION_STEP_ID,
      classicTransaction,
    );
    await seedStepOutput(
      context,
      SIMULATE_TRANSACTION_STEP_ID,
      simulation("recording"),
    );
    await seedStepOutput(context, INVOKE_CONTRACT_INPUT_STEP_ID, invokeInput);

    await assertRejects(
      () =>
        signAuthEntriesToAssembleForEnforcement().runWith(
          { context: { parent: context } },
          entry,
        ),
      EXPECTED_INVOKE_HOST_FUNCTION_OPERATION,
    );
  });

  it("connects the prepared transaction to enforcing simulation", async () => {
    const context = createRunContext();
    const recording = simulation("recording");
    const rpc = {} as Server;
    await seedStepOutput(context, SIMULATE_TRANSACTION_STEP_ID, recording);

    const result = await assembleForEnforcementToEnforceSimulation(rpc).runWith(
      { context: { parent: context } },
      transaction,
    );

    assertStrictEquals(result.transaction, transaction);
    assertStrictEquals(result.recordingSimulation, recording);
    assertStrictEquals(result.rpc, rpc);
  });

  it("uses the final simulation resources with the original transaction and auth", async () => {
    const context = createRunContext();
    const enforcing = simulation("enforcing");
    await seedStepOutput(context, BUILD_TRANSACTION_STEP_ID, transaction);
    await seedStepOutput(context, SIGN_AUTH_ENTRIES_STEP_ID, [entry]);
    await seedStepOutput(
      context,
      INVOKE_CONTRACT_INPUT_STEP_ID,
      invokeInput,
    );

    const result = await enforceSimulationToAssemble().runWith(
      { context: { parent: context } },
      enforcing,
    );

    assertStrictEquals(result.transaction, transaction);
    assertEquals(result.authEntries, [entry]);
    assertStrictEquals(result.sorobanData, enforcing.transactionData);
    assertEquals(result.transactionFee, { max: "500" });
    assertEquals(result.resourceFee, undefined);
  });

  it("omits an explicit final strategy for a string fee", async () => {
    const context = createRunContext();
    await seedStepOutput(context, BUILD_TRANSACTION_STEP_ID, transaction);
    await seedStepOutput(context, SIGN_AUTH_ENTRIES_STEP_ID, [entry]);
    await seedStepOutput(
      context,
      INVOKE_CONTRACT_INPUT_STEP_ID,
      invokeInputWithStringFee,
    );

    const result = await enforceSimulationToAssemble().runWith(
      { context: { parent: context } },
      simulation("enforcing"),
    );

    assertEquals(result.transactionFee, undefined);
  });
});
