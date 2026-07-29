import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Address,
  Asset,
  buildWithDelegatesEntry,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { Buffer } from "buffer";
import { postAuthAssembleTransaction } from "@/processes/post-auth-assemble-transaction/index.ts";
import type { PostAuthAssembleTransactionInput } from "@/processes/post-auth-assemble-transaction/types.ts";
import * as E from "@/processes/post-auth-assemble-transaction/error.ts";
import * as AssembleErrors from "@/processes/assemble-transaction/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { getOperationsFromTransaction } from "@/common/helpers/transaction.ts";

const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
const rootAddress = Address.contract(Buffer.alloc(32, 1));
const delegateAddress = Address.account(Buffer.alloc(32, 2));
const invokeArgs = new xdr.InvokeContractArgs({
  contractAddress: rootAddress.toScAddress(),
  functionName: "authorize",
  args: [],
});
const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(
  invokeArgs,
);
const invocation = new xdr.SorobanAuthorizedInvocation({
  function: xdr.SorobanAuthorizedFunction
    .sorobanAuthorizedFunctionTypeContractFn(
      invokeArgs,
    ),
  subInvocations: [],
});

const makeAuthEntry = () =>
  new xdr.SorobanAuthorizationEntry({
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

const makeDelegatedEntry = () =>
  buildWithDelegatesEntry({
    entry: makeAuthEntry(),
    validUntilLedgerSeq: 100,
    delegates: [{ address: delegateAddress.toString() }],
  });

const makeInvokeOperation = (
  auth: xdr.SorobanAuthorizationEntry[] = [],
) => Operation.invokeHostFunction({ func: hostFunction, auth });

const makeTransaction = (operation = makeInvokeOperation()) =>
  new TransactionBuilder(new Account(source, "100"), {
    fee: "100",
    networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(0)
    .build();

describe("postAuthAssembleTransaction", () => {
  it("passes ordinary authorization through unchanged", async () => {
    const transaction = makeTransaction();

    const result = await postAuthAssembleTransaction({
      transaction,
      authorizedOperation: makeInvokeOperation([makeAuthEntry()]),
      sorobanData: new SorobanDataBuilder(),
      resourceFee: 10,
    });

    assertStrictEquals(result, transaction);
  });

  it("assembles delegated entries for enforcing simulation", async () => {
    const transaction = makeTransaction();
    const delegatedEntry = makeDelegatedEntry();

    const result = await postAuthAssembleTransaction({
      transaction,
      authorizedOperation: makeInvokeOperation([delegatedEntry]),
      sorobanData: new SorobanDataBuilder(),
      resourceFee: 10,
    });

    const assembledAuth = getOperationsFromTransaction(result)[0].body()
      .invokeHostFunctionOp().auth();
    assertEquals(assembledAuth.length, 1);
    assertEquals(
      assembledAuth[0].credentials().switch().value,
      xdr.SorobanCredentialsType.sorobanCredentialsAddressWithDelegates()
        .value,
    );
    assertEquals(result.fee, "110");
  });

  it("requires the authorized operation", async () => {
    const input = {
      transaction: makeTransaction(),
      authorizedOperation: undefined,
      resourceFee: 10,
    } as unknown as PostAuthAssembleTransactionInput;

    await assertRejects(
      () => postAuthAssembleTransaction(input),
      E.MISSING_ARG,
    );
  });

  it("preserves typed assembly failures", async () => {
    const paymentTransaction = makeTransaction(
      Operation.payment({
        destination: source,
        asset: Asset.native(),
        amount: "1",
      }),
    );

    await assertRejects(
      () =>
        postAuthAssembleTransaction({
          transaction: paymentTransaction,
          authorizedOperation: makeInvokeOperation([makeDelegatedEntry()]),
          sorobanData: new SorobanDataBuilder(),
          resourceFee: 10,
        }),
      AssembleErrors.NOT_SMART_CONTRACT_TRANSACTION_ERROR,
    );
  });

  it("normalizes unexpected failures", async () => {
    await assertRejects(
      () =>
        postAuthAssembleTransaction(
          null as unknown as PostAuthAssembleTransactionInput,
        ),
      E.UNEXPECTED_ERROR,
    );
  });
});
