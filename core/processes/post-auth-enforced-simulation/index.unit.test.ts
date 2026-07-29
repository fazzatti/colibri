import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
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
import type { Api, Server } from "stellar-sdk/rpc";
import { Buffer } from "buffer";
import { postAuthEnforcedSimulation } from "@/processes/post-auth-enforced-simulation/index.ts";
import type { PostAuthEnforcedSimulationInput } from "@/processes/post-auth-enforced-simulation/types.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import * as E from "@/processes/post-auth-enforced-simulation/error.ts";
import * as SimulateErrors from "@/processes/simulate-transaction/error.ts";
import { NetworkConfig } from "@/network/index.ts";

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
const entry = new xdr.SorobanAuthorizationEntry({
  credentials: xdr.SorobanCredentials.sorobanCredentialsAddressV2(
    new xdr.SorobanAddressCredentials({
      address: rootAddress.toScAddress(),
      nonce: new xdr.Int64(1),
      signatureExpirationLedger: 0,
      signature: xdr.ScVal.scvVoid(),
    }),
  ),
  rootInvocation: invocation,
});
const delegatedEntry = buildWithDelegatesEntry({
  entry,
  validUntilLedgerSeq: 100,
  delegates: [{ address: delegateAddress.toString() }],
});

const makeTransaction = (
  auth: xdr.SorobanAuthorizationEntry[] = [],
) =>
  new TransactionBuilder(new Account(source, "100"), {
    fee: "100",
    networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs),
        auth,
      }),
    )
    .setTimeout(0)
    .build();

const makeSimulation = (
  id: string,
): SimulateTransactionOutput => ({
  id,
  latestLedger: 100,
  events: [],
  minResourceFee: "10",
  transactionData: new SorobanDataBuilder(),
  result: { auth: [], retval: nativeToScVal(null) },
  _parsed: true,
});

describe("postAuthEnforcedSimulation", () => {
  it("returns the recording simulation without RPC for ordinary auth", async () => {
    const recordingSimulation = makeSimulation("recording");
    let calls = 0;
    const rpc = {
      simulateTransaction: () => {
        calls++;
        return makeSimulation("unexpected");
      },
    } as unknown as Server;

    const result = await postAuthEnforcedSimulation({
      transaction: makeTransaction([entry]),
      recordingSimulation,
      rpc,
    });

    assertStrictEquals(result, recordingSimulation);
    assertEquals(calls, 0);
  });

  it("runs and returns the enforcing simulation for delegated auth", async () => {
    const enforcingSimulation = makeSimulation("enforcing");
    let calls = 0;
    const rpc = {
      simulateTransaction: () => {
        calls++;
        return enforcingSimulation as Api.SimulateTransactionSuccessResponse;
      },
    } as unknown as Server;

    const result = await postAuthEnforcedSimulation({
      transaction: makeTransaction([delegatedEntry]),
      recordingSimulation: makeSimulation("recording"),
      rpc,
    });

    assertEquals(result.id, enforcingSimulation.id);
    assertEquals(result.minResourceFee, enforcingSimulation.minResourceFee);
    assertEquals(calls, 1);
  });

  it("requires the recording simulation", async () => {
    const input = {
      transaction: makeTransaction(),
      recordingSimulation: undefined,
      rpc: {},
    } as unknown as PostAuthEnforcedSimulationInput;

    await assertRejects(
      () => postAuthEnforcedSimulation(input),
      E.MISSING_ARG,
    );
  });

  it("preserves typed simulation failures", async () => {
    const rpc = {
      simulateTransaction: () => {
        throw new Error("offline");
      },
    } as unknown as Server;

    await assertRejects(
      () =>
        postAuthEnforcedSimulation({
          transaction: makeTransaction([delegatedEntry]),
          recordingSimulation: makeSimulation("recording"),
          rpc,
        }),
      SimulateErrors.COULD_NOT_SIMULATE_TRANSACTION,
    );
  });

  it("normalizes unexpected failures", async () => {
    await assertRejects(
      () =>
        postAuthEnforcedSimulation(
          null as unknown as PostAuthEnforcedSimulationInput,
        ),
      E.UNEXPECTED_ERROR,
    );
  });
});
