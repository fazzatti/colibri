import { assertEquals, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
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
import { Buffer } from "buffer";
import {
  assembleForEnforcementToEnforceSimulation,
  enforceSimulationToAssemble,
  INVOKE_CONTRACT_INPUT_STEP_ID,
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
        nonce: new xdr.Int64(1),
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
