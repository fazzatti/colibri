import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
} from "stellar-sdk";
import {
  getTransactionInclusionFee,
  getTransactionResourceFee,
  setTransactionFee,
} from "@/common/helpers/transaction-fee.ts";
import type { TransactionFee } from "@/common/types/transaction-config/types.ts";
import { NetworkConfig } from "@/network/index.ts";
import * as E from "@/processes/assemble-transaction/error.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";

const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";

const createTransaction = (resourceFee?: number) => {
  const builder = new TransactionBuilder(new Account(source, "100"), {
    fee: "100",
    networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        function: "transfer",
        args: [],
      }),
    )
    .setTimeout(0);

  if (resourceFee !== undefined) {
    builder.setSorobanData(
      new SorobanDataBuilder().setResourceFee(resourceFee).build(),
    );
  }

  return builder.build();
};

const assembleWith = (
  transactionFee: TransactionFee | undefined,
  resourceFee = 3,
  transaction = createTransaction(),
  resourceFeeOverride?: string,
) =>
  assembleTransaction({
    transaction,
    transactionFee,
    sorobanData: new SorobanDataBuilder().setResourceFee(resourceFee),
    authEntries: [],
    resourceFee: resourceFeeOverride,
  });

describe("assembleTransaction fee strategies", () => {
  it("assembles without Soroban data by using zero resource fee", async () => {
    const transaction = await assembleTransaction({
      transaction: createTransaction(),
      authEntries: [],
    });

    assertEquals(transaction.fee, "100");
    assertEquals(getTransactionResourceFee(transaction), 0n);
  });

  it("preserves the incoming inclusion fee and uses the simulated resource fee once", async () => {
    const transaction = await assembleWith(undefined, 3);

    assertEquals(transaction.fee, "103");
    assertEquals(getTransactionInclusionFee(transaction), 100n);
    assertEquals(getTransactionResourceFee(transaction), 3n);
  });

  it("overrides the simulated resource fee without mutating its Soroban data", async () => {
    const sorobanData = new SorobanDataBuilder().setResourceFee(3);
    const transaction = await assembleTransaction({
      transaction: createTransaction(),
      sorobanData,
      authEntries: [],
      resourceFee: "5",
    });

    assertEquals(transaction.fee, "105");
    assertEquals(getTransactionInclusionFee(transaction), 100n);
    assertEquals(getTransactionResourceFee(transaction), 5n);
    assertEquals(sorobanData.build().resourceFee().toBigInt(), 3n);
  });

  it("applies a resource-fee override when Soroban data is omitted", async () => {
    const transaction = await assembleTransaction({
      transaction: createTransaction(),
      authEntries: [],
      resourceFee: "5",
    });

    assertEquals(transaction.fee, "105");
    assertEquals(getTransactionResourceFee(transaction), 5n);
  });

  it("uses an overridden resource fee when resolving a maximum", async () => {
    const transaction = await assembleWith(
      { max: "500" },
      3,
      undefined,
      "5",
    );

    assertEquals(transaction.fee, "500");
    assertEquals(getTransactionInclusionFee(transaction), 495n);
    assertEquals(getTransactionResourceFee(transaction), 5n);
  });

  it("preserves inclusion when replacing previously assembled resources", async () => {
    const previouslyAssembled = createTransaction(3);
    const transaction = await assembleWith(undefined, 5, previouslyAssembled);

    assertEquals(transaction.fee, "105");
    assertEquals(getTransactionInclusionFee(transaction), 100n);
    assertEquals(getTransactionResourceFee(transaction), 5n);
  });

  it("adds an explicit base fee to the simulated resource fee", async () => {
    const transaction = await assembleWith({ base: "101" });

    assertEquals(transaction.fee, "104");
    assertEquals(getTransactionInclusionFee(transaction), 101n);
    assertEquals(getTransactionResourceFee(transaction), 3n);
  });

  it("adds an exact inclusion fee to the simulated resource fee", async () => {
    const transaction = await assembleWith({ inclusion: "201" });

    assertEquals(transaction.fee, "204");
    assertEquals(getTransactionInclusionFee(transaction), 201n);
    assertEquals(getTransactionResourceFee(transaction), 3n);
  });

  it("uses all remaining fee capacity as inclusion under a maximum", async () => {
    const transaction = await assembleWith({ max: "500" });

    assertEquals(transaction.fee, "500");
    assertEquals(getTransactionInclusionFee(transaction), 497n);
    assertEquals(getTransactionResourceFee(transaction), 3n);
  });

  it("rejects a fee object without exactly one supported mode", async () => {
    await assertRejects(
      () => assembleWith({} as TransactionFee),
      E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR,
    );
  });

  it("uses a mode-specific error for every invalid amount", async () => {
    await assertRejects(
      () => assembleWith({ base: "bad" } as unknown as TransactionFee),
      E.INVALID_BASE_FEE_ERROR,
    );
    await assertRejects(
      () => assembleWith({ inclusion: "bad" } as unknown as TransactionFee),
      E.INVALID_INCLUSION_FEE_ERROR,
    );
    await assertRejects(
      () => assembleWith({ max: "bad" } as unknown as TransactionFee),
      E.INVALID_MAX_FEE_ERROR,
    );
  });

  it("rejects a non-positive explicit base fee", async () => {
    await assertRejects(
      () => assembleWith({ base: "0" }),
      E.BASE_FEE_TOO_LOW_ERROR,
    );
  });

  it("requires at least 100 stroops of explicit inclusion fee", async () => {
    await assertRejects(
      () => assembleWith({ inclusion: "99" }),
      E.INCLUSION_FEE_TOO_LOW_ERROR,
    );
  });

  it("requires a maximum to cover resources and minimum inclusion", async () => {
    await assertRejects(
      () => assembleWith({ max: "102" }),
      E.MAX_FEE_TOO_LOW_ERROR,
    );
  });

  it("rejects malformed resource-fee overrides", async () => {
    for (const resourceFee of ["", "-1", "1.5", " 3"]) {
      await assertRejects(
        () => assembleWith(undefined, 3, undefined, resourceFee),
        E.INVALID_RESOURCE_FEE_ERROR,
      );
    }

    await assertRejects(
      () =>
        assembleTransaction({
          transaction: createTransaction(),
          sorobanData: new SorobanDataBuilder().setResourceFee(3),
          authEntries: [],
          resourceFee: 5 as unknown as string,
        }),
      E.INVALID_RESOURCE_FEE_ERROR,
    );
  });

  it("rejects a resource-fee override below the simulated minimum", async () => {
    await assertRejects(
      () => assembleWith(undefined, 3, undefined, "2"),
      E.RESOURCE_FEE_BELOW_SIMULATED_MINIMUM_ERROR,
    );
  });

  it("rejects a resource-fee override above the transaction XDR limit", async () => {
    await assertRejects(
      () => assembleWith(undefined, 3, undefined, "4294967296"),
      E.TRANSACTION_FEE_TOO_HIGH_ERROR,
    );
  });

  it("rejects a final total that does not fit transaction XDR", async () => {
    await assertRejects(
      () => assembleWith({ inclusion: "4294967295" }),
      E.TRANSACTION_FEE_TOO_HIGH_ERROR,
    );
  });

  it("rejects an input whose total fee is below its embedded resource fee", async () => {
    const inconsistentTransaction = setTransactionFee(
      createTransaction(200),
      100n,
    );

    await assertRejects(
      () => assembleWith(undefined, 3, inconsistentTransaction),
      E.TRANSACTION_FEE_BELOW_RESOURCE_FEE_ERROR,
    );
  });

  it("keeps every assemble-transaction error code unique", () => {
    const codes = Object.values(E.Code);
    assertEquals(new Set(codes).size, codes.length);
    assertEquals(Object.keys(E.ERROR_BY_CODE).sort(), [...codes].sort());
  });
});
