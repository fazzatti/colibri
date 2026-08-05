import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Operation, SorobanDataBuilder } from "stellar-sdk";
import {
  getTransactionInclusionFee,
  getTransactionResourceFee,
} from "@/common/helpers/transaction-fee.ts";
import { NetworkConfig } from "@/network/index.ts";
import { buildTransaction } from "@/processes/build-transaction/index.ts";
import type { BuildTransactionInput } from "@/processes/build-transaction/types.ts";
import * as E from "@/processes/build-transaction/error.ts";

const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
const operations = [
  Operation.setOptions({}),
  Operation.setOptions({}),
  Operation.setOptions({}),
];

const inputWith = (
  fee: Pick<BuildTransactionInput, "baseFee" | "transactionFee">,
): BuildTransactionInput => ({
  ...fee,
  operations,
  source,
  sequence: "100",
  networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
} as BuildTransactionInput);

const sorobanInputWith = (
  fee: Pick<BuildTransactionInput, "baseFee" | "transactionFee">,
  resourceFee = 100,
): BuildTransactionInput => ({
  ...fee,
  operations: [
    Operation.invokeContractFunction({
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      function: "transfer",
      args: [],
    }),
  ],
  source,
  sequence: "100",
  networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
  sorobanData: new SorobanDataBuilder().setResourceFee(resourceFee).build(),
} as BuildTransactionInput);

describe("buildTransaction fee strategies", () => {
  it("keeps the string fee as a per-operation base fee", async () => {
    const transaction = await buildTransaction(inputWith({ baseFee: "101" }));

    assertEquals(transaction.fee, "303");
  });

  it("applies an explicit base fee per operation", async () => {
    const transaction = await buildTransaction(
      inputWith({ transactionFee: { base: "101" } }),
    );

    assertEquals(transaction.fee, "303");
  });

  it("sets an exact total inclusion fee without rounding", async () => {
    const transaction = await buildTransaction(
      inputWith({ transactionFee: { inclusion: "302" } }),
    );

    assertEquals(transaction.fee, "302");
  });

  it("sets the maximum as the exact total for a classic transaction", async () => {
    const transaction = await buildTransaction(
      inputWith({ transactionFee: { max: "302" } }),
    );

    assertEquals(transaction.fee, "302");
  });

  it("adds supplied Soroban resources once for string and explicit base fees", async () => {
    const stringTransaction = await buildTransaction(
      sorobanInputWith({ baseFee: "101" }),
    );
    const explicitTransaction = await buildTransaction(
      sorobanInputWith({ transactionFee: { base: "101" } }),
    );

    for (const transaction of [stringTransaction, explicitTransaction]) {
      assertEquals(transaction.fee, "201");
      assertEquals(getTransactionInclusionFee(transaction), 101n);
      assertEquals(getTransactionResourceFee(transaction), 100n);
    }
  });

  it("adds supplied Soroban resources to an exact inclusion fee", async () => {
    const transaction = await buildTransaction(
      sorobanInputWith({ transactionFee: { inclusion: "205" } }),
    );

    assertEquals(transaction.fee, "305");
    assertEquals(getTransactionInclusionFee(transaction), 205n);
    assertEquals(getTransactionResourceFee(transaction), 100n);
  });

  it("uses a Soroban maximum as the exact resource-inclusive total", async () => {
    const transaction = await buildTransaction(
      sorobanInputWith({ transactionFee: { max: "250" } }),
    );

    assertEquals(transaction.fee, "250");
    assertEquals(getTransactionInclusionFee(transaction), 150n);
    assertEquals(getTransactionResourceFee(transaction), 100n);
  });

  it("supports a maximum at the transaction XDR limit with Soroban resources", async () => {
    const transaction = await buildTransaction(
      sorobanInputWith({ transactionFee: { max: "4294967295" } }),
    );

    assertEquals(transaction.fee, "4294967295");
    assertEquals(getTransactionInclusionFee(transaction), 4294967195n);
    assertEquals(getTransactionResourceFee(transaction), 100n);
  });

  it("requires exactly one build-process fee input", async () => {
    await assertRejects(
      () =>
        buildTransaction({
          ...inputWith({ baseFee: "100" }),
          transactionFee: { base: "100" },
        } as BuildTransactionInput),
      E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR,
    );
    await assertRejects(
      () =>
        buildTransaction({
          ...inputWith({ baseFee: "100" }),
          baseFee: undefined,
        } as unknown as BuildTransactionInput),
      E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR,
    );
  });

  it("rejects a fee object without exactly one supported mode", async () => {
    await assertRejects(
      () =>
        buildTransaction(
          inputWith({ transactionFee: {} } as unknown as Pick<
            BuildTransactionInput,
            "baseFee" | "transactionFee"
          >),
        ),
      E.INVALID_TRANSACTION_FEE_CONFIGURATION_ERROR,
    );
  });

  it("uses a mode-specific error for every invalid amount", async () => {
    await assertRejects(
      () =>
        buildTransaction(
          inputWith({ transactionFee: { base: "bad" } } as unknown as Pick<
            BuildTransactionInput,
            "baseFee" | "transactionFee"
          >),
        ),
      E.INVALID_BASE_FEE_ERROR,
    );
    await assertRejects(
      () =>
        buildTransaction(
          inputWith({
            transactionFee: { inclusion: "bad" },
          } as unknown as Pick<
            BuildTransactionInput,
            "baseFee" | "transactionFee"
          >),
        ),
      E.INVALID_INCLUSION_FEE_ERROR,
    );
    await assertRejects(
      () =>
        buildTransaction(
          inputWith({ transactionFee: { max: "bad" } } as unknown as Pick<
            BuildTransactionInput,
            "baseFee" | "transactionFee"
          >),
        ),
      E.INVALID_MAX_FEE_ERROR,
    );
  });

  it("rejects a non-positive explicit base fee", async () => {
    await assertRejects(
      () => buildTransaction(inputWith({ transactionFee: { base: "0" } })),
      E.BASE_FEE_TOO_LOW_ERROR,
    );
  });

  it("requires exact classic fees to cover every operation", async () => {
    await assertRejects(
      () =>
        buildTransaction(
          inputWith({ transactionFee: { inclusion: "299" } }),
        ),
      E.INCLUSION_FEE_TOO_LOW_ERROR,
    );
    await assertRejects(
      () => buildTransaction(inputWith({ transactionFee: { max: "299" } })),
      E.MAX_FEE_TOO_LOW_ERROR,
    );
  });

  it("requires a Soroban maximum to cover resources and minimum inclusion", async () => {
    await assertRejects(
      () =>
        buildTransaction(
          sorobanInputWith({ transactionFee: { max: "199" } }),
        ),
      E.MAX_FEE_TOO_LOW_ERROR,
    );
  });

  it("rejects exact fees that do not fit the transaction XDR", async () => {
    await assertRejects(
      () =>
        buildTransaction(
          inputWith({ transactionFee: { inclusion: "4294967296" } }),
        ),
      E.TRANSACTION_FEE_TOO_HIGH_ERROR,
    );
    await assertRejects(
      () =>
        buildTransaction(
          sorobanInputWith({
            transactionFee: { inclusion: "4294967295" },
          }),
        ),
      E.TRANSACTION_FEE_TOO_HIGH_ERROR,
    );
  });

  it("keeps every build-transaction error code unique", () => {
    const codes = Object.values(E.Code);
    assertEquals(new Set(codes).size, codes.length);
    assertEquals(Object.keys(E.ERROR_BY_CODE).sort(), [...codes].sort());
  });
});
