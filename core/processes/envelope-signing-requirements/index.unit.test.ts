// deno-lint-ignore-file no-explicit-any
import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  MuxedAccount,
  Operation,
  type Transaction,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import { P_EnvelopeSigningRequirements } from "@/processes/envelope-signing-requirements/index.ts";
import * as E from "@/processes/envelope-signing-requirements/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { muxedAddressToBaseAccount } from "@/transformers/address/index.ts";
import type { EnvelopeSigningRequirementsInput } from "@/processes/envelope-signing-requirements/types.ts";
import type { MuxedAddress } from "@/strkeys/types.ts";
import { OperationThreshold } from "@/signer/types.ts";

describe("EnvelopeSigningRequirements", () => {
  const { networkPassphrase } = NetworkConfig.TestNet();

  const assembleTransactionWithMuxed = (
    muxed: MuxedAddress,
    operations: xdr.Operation[]
  ) => {
    const source = muxedAddressToBaseAccount(muxed);
    const sourceAcc = new Account(source, "100");

    const muxedAcc = new MuxedAccount(sourceAcc, "100");

    const tx = new TransactionBuilder(muxedAcc, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    });

    for (const op of operations) {
      tx.addOperation(op);
    }

    tx.setTimeout(0);
    return tx.build();
  };

  const assembleTransaction = (source: string, operations: xdr.Operation[]) => {
    const sourceAcc = new Account(source, "100");

    const tx = new TransactionBuilder(sourceAcc, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    });

    for (const op of operations) {
      tx.addOperation(op);
    }

    tx.setTimeout(0);
    return tx.build();
  };

  describe("Construction", () => {
    it("creates process with proper name", () => {
      assertEquals(
        P_EnvelopeSigningRequirements().name,
        "EnvelopeSigningRequirements"
      );
    });
  });

  describe("Features", () => {
    it("Calculates the requirements for a minimal Transaction", async () => {
      const transaction = assembleTransaction(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        [Operation.setOptions({})]
      );

      const result = await P_EnvelopeSigningRequirements().run({ transaction });

      assert(result);
      assert(result.length);
      assertEquals(result.length, 1);
      assertEquals(result[0], {
        address: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        thresholdLevel: OperationThreshold.medium,
      });
    });

    it("Calculates the requirements for a minimal FeeBumpTransaction", async () => {
      const transaction = assembleTransaction(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        [Operation.setOptions({})]
      );

      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        "GDMZZQ62ZEO4B7YMBHPJ3LHCLIYOG7JE4XCHEGHV4MINCN6O3WFA4MVQ",
        "100",
        transaction,
        networkPassphrase
      );

      const result = await P_EnvelopeSigningRequirements().run({
        transaction: feebump,
      });

      assert(result);
      assert(result.length);
      assertEquals(result.length, 1);
      assertEquals(result[0], {
        address: "GDMZZQ62ZEO4B7YMBHPJ3LHCLIYOG7JE4XCHEGHV4MINCN6O3WFA4MVQ",
        thresholdLevel: OperationThreshold.low,
      });
    });

    it("Converts the Transaction source from Muxed to base account ", async () => {
      const transaction = assembleTransactionWithMuxed(
        "MB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU2AAAAAAAAAAAAECKK",
        [Operation.setOptions({})]
      );

      const result = await P_EnvelopeSigningRequirements().run({ transaction });

      assert(result);
      assert(result.length);
      assertEquals(result.length, 1);
      assertEquals(result[0], {
        address: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        thresholdLevel: OperationThreshold.medium,
      });
    });

    it("Converts the FeeBumpTransaction source from Muxed to base account", async () => {
      const transaction = assembleTransaction(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        [Operation.setOptions({})]
      );

      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        "MB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU2AAAAAAAAAAAAECKK",
        "100",
        transaction,
        networkPassphrase
      );

      const result = await P_EnvelopeSigningRequirements().run({
        transaction: feebump,
      });

      assert(result);
      assert(result.length);
      assertEquals(result.length, 1);
      assertEquals(result[0], {
        address: "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        thresholdLevel: OperationThreshold.low,
      });
    });

    it("Calculates the requirements for a Transaction with multiple operations", async () => {
      const alice = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
      const bob = "GDMZZQ62ZEO4B7YMBHPJ3LHCLIYOG7JE4XCHEGHV4MINCN6O3WFA4MVQ";
      const charlie =
        "GD5PUITTMNVKWHSLXIWU732MOSEONSMYCXU3A5KS2USRWQONMYO5TTFN";

      const opMedAlice = Operation.setOptions({ source: alice });
      const opHighAlice = Operation.accountMerge({
        source: alice,
        destination: bob,
      });
      const opLowBob = Operation.bumpSequence({
        source: bob,
        bumpTo: "200",
      });

      const opLowCharlie = Operation.bumpSequence({
        source: charlie,
        bumpTo: "200",
      });

      const transaction = assembleTransaction(charlie, [
        opMedAlice,
        opHighAlice,
        opLowBob,
        opLowCharlie,
      ]);

      const result = await P_EnvelopeSigningRequirements().run({
        transaction,
      });

      assert(result);
      assert(result.length);
      assertEquals(result.length, 3);

      const hasMedAlice =
        result.filter(
          (r) =>
            r.address === alice &&
            r.thresholdLevel === OperationThreshold.medium
        ).length === 1;
      const hasHighAlice =
        result.filter(
          (r) =>
            r.address === alice && r.thresholdLevel === OperationThreshold.high
        ).length === 1;

      const hasLowBob =
        result.filter(
          (r) =>
            r.address === bob && r.thresholdLevel === OperationThreshold.low
        ).length === 1;
      const hasLowCharlie =
        result.filter(
          (r) =>
            r.address === charlie && r.thresholdLevel === OperationThreshold.low
        ).length === 1;

      const hasMedCharlie =
        result.filter(
          (r) =>
            r.address === charlie &&
            r.thresholdLevel === OperationThreshold.medium
        ).length === 1;

      assert(hasHighAlice);
      assert(hasLowBob);
      assert(hasMedCharlie);
      assert(!hasLowCharlie);
      assert(!hasMedAlice);
    });

    it("Calculates the requirements for a Transaction with multiple operations involving Muxed addresses", async () => {
      const alice = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
      const aliceMuxed =
        "MB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU2AAAAAAAAAAAAECKK";
      const bob = "GDMZZQ62ZEO4B7YMBHPJ3LHCLIYOG7JE4XCHEGHV4MINCN6O3WFA4MVQ";
      const bobMuxed =
        "MDMZZQ62ZEO4B7YMBHPJ3LHCLIYOG7JE4XCHEGHV4MINCN6O3WFA4AAAAAAAAAAAAHKVA";
      const charlie =
        "GD5PUITTMNVKWHSLXIWU732MOSEONSMYCXU3A5KS2USRWQONMYO5TTFN";
      const charlieMuxed =
        "MD5PUITTMNVKWHSLXIWU732MOSEONSMYCXU3A5KS2USRWQONMYO5SAAAAAAAAAAAAEKSM";

      const opMedAlice = Operation.setOptions({ source: alice });
      const opHighAlice = Operation.accountMerge({
        source: aliceMuxed,
        destination: bob,
      });
      const opLowBob = Operation.bumpSequence({
        source: bobMuxed,
        bumpTo: "200",
      });

      const opLowCharlie = Operation.bumpSequence({
        source: charlieMuxed,
        bumpTo: "200",
      });

      const transaction = assembleTransaction(charlie, [
        opMedAlice,
        opHighAlice,
        opLowBob,
        opLowCharlie,
      ]);

      const result = await P_EnvelopeSigningRequirements().run({
        transaction,
      });

      assert(result);
      assert(result.length);
      assertEquals(result.length, 3);

      const hasMedAlice =
        result.filter(
          (r) =>
            r.address === alice &&
            r.thresholdLevel === OperationThreshold.medium
        ).length === 1;
      const hasHighAlice =
        result.filter(
          (r) =>
            r.address === alice && r.thresholdLevel === OperationThreshold.high
        ).length === 1;

      const hasLowBob =
        result.filter(
          (r) =>
            r.address === bob && r.thresholdLevel === OperationThreshold.low
        ).length === 1;
      const hasLowCharlie =
        result.filter(
          (r) =>
            r.address === charlie && r.thresholdLevel === OperationThreshold.low
        ).length === 1;

      const hasMedCharlie =
        result.filter(
          (r) =>
            r.address === charlie &&
            r.thresholdLevel === OperationThreshold.medium
        ).length === 1;

      assert(hasHighAlice);
      assert(hasLowBob);
      assert(hasMedCharlie);
      assert(!hasLowCharlie);
      assert(!hasMedAlice);
    });
  });

  describe("Errors", () => {
    it("throws UNEXPECTED_ERROR if an untracked error happens", async () => {
      const faultyInput = null as unknown as EnvelopeSigningRequirementsInput;

      await assertRejects(
        async () => await P_EnvelopeSigningRequirements().run(faultyInput),
        E.UNEXPECTED_ERROR
      );
    });

    it("throws INVALID_TRANSACTION_TYPE if the  transaction type is not supported", async () => {
      const transaction = null as unknown as Transaction;

      await assertRejects(
        async () => await P_EnvelopeSigningRequirements().run({ transaction }),
        E.INVALID_TRANSACTION_TYPE
      );
    });

    it("throws FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX if failing to process the FeeBumpTransaction requirements", async () => {
      const transaction = assembleTransaction(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        [Operation.setOptions({})]
      );

      const feebump = TransactionBuilder.buildFeeBumpTransaction(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        "100",
        transaction,
        networkPassphrase
      );

      const faultyTx = transaction;
      //transform transaction into a fake FeeBumpTransaction
      (faultyTx as any).feeSource = "FAULTY"; // Force a faulty fee source
      (faultyTx as any).innerTransaction = feebump.innerTransaction; // Add innerTransaction property to pass isFeeBumpTransaction check
      Object.setPrototypeOf(faultyTx, Object.getPrototypeOf(feebump));

      await assertRejects(
        async () =>
          await P_EnvelopeSigningRequirements().run({ transaction: faultyTx }),
        E.FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX
      );
    });

    it("throws FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION if failing to process the Transaction requirements", async () => {
      const transaction = assembleTransaction(
        "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P",
        [Operation.setOptions({})]
      );
      const faultyTx = {
        source: "FAULTY",
      } as unknown as Transaction;

      //transform transaction into a fake Transaction

      Object.setPrototypeOf(faultyTx, Object.getPrototypeOf(transaction));

      await assertRejects(
        async () =>
          await P_EnvelopeSigningRequirements().run({
            transaction: faultyTx,
          }),
        E.FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION
      );
    });
  });
});
