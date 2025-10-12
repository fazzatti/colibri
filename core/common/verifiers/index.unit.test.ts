import { assert, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
  type FeeBumpTransaction,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { TestNet } from "../../network/index.ts";
import { isTransaction } from "./is-transaction.ts";
import { isFeeBumpTransaction } from "./is-fee-bump-transaction.ts";
import { StrKey } from "../../strkeys/index.ts";
import { isSigningThreshold } from "./is-signing-threshold.ts";
import { isSmartContractTransaction } from "./is-smart-contract-transaction.ts";

describe("Verifiers", () => {
  describe("isEd25519PublicKey", () => {
    it("should verify correct ed25519 public keys", () => {
      const correctAddresses = [
        "GCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G7",
        "GCDA2GPJ64HZJH2M65SM4A3AB2WYMMPUEWA2Q6FAYFY7BJNPSHQEVRFX",
        "GDX7KFLHVQCNA3JLIONQ5ETHMWFKQP56NZ6WJXFEXPAWL4DSFMO6U34U",
        "GBVTWBBCCRFCB7LBNZSN6FC6IL6BIW4XENDYE653XPSSQFL5WNIE4PMT",
      ];

      for (const address of correctAddresses) {
        assert(StrKey.isEd25519PublicKey(address));
      }
    });

    it("should verify incorrect ed25519 public keys", () => {
      const incorrectAddresses = [
        "",
        "GCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G",
        "CCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G",
        "FCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G7",
        "G12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901",
        "MBVTWBBCCRFCB7LBNZSN6FC6IL6BIW4XENDYE653XPSSQFL5WNIE4AAAAAAAAAAAAEQWS",
        1 as unknown as string,
        null as unknown as string,
        undefined as unknown as string,
        {} as unknown as string,
        [] as unknown as string,
      ];

      for (const address of incorrectAddresses) {
        assertFalse(StrKey.isEd25519PublicKey(address));
      }
    });
  });

  describe("isMuxedAddress", () => {
    it("should validate muxed addresses", () => {
      const correctAddresses = [
        "MBVTWBBCCRFCB7LBNZSN6FC6IL6BIW4XENDYE653XPSSQFL5WNIE4AAAAAAAAAAAAEQWS",
        "MBVTWBBCCRFCB7LBNZSN6FC6IL6BIW4XENDYE653XPSSQFL5WNIE4AAAAAAAAAAAAJBFS",
        "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWAAAAAAAAAAAALBYS",
        "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWDOAWUHEJP5MVZQYI",
      ];

      for (const address of correctAddresses) {
        assert(StrKey.isMuxedAddress(address));
      }
    });

    it("should verify incorrect muxed addresses", () => {
      const incorrectAddresses = [
        "",
        "GDX7KFLHVQCNA3JLIONQ5ETHMWFKQP56NZ6WJXFEXPAWL4DSFMO6U34U",
        "CDX7KFLHVQCNA3JLIONQ5ETHMWFKQP56NZ6WJXFEXPAWL4DSFMO6U34U",
        "G12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901",
        "MBVTWBBCCRFCB7LBNZSN6FC6IL6BIW4XENDYE653XPSSQFL5WNIE4AAAAAAAAAAAAEQW",
        1 as unknown as string,
        null as unknown as string,
        undefined as unknown as string,
        {} as unknown as string,
        [] as unknown as string,
      ];

      for (const address of incorrectAddresses) {
        assertFalse(StrKey.isMuxedAddress(address));
      }
    });
  });

  describe("isTransaction", () => {
    const { networkPassphrase } = TestNet();
    it("should verify valid Transaction objects as true", () => {
      const mockTransactions = [
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAASwAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAA=",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABy6rRnxRIjFIzSAmV8BbmxVVc8gijT2oAluc+FcWUDFAAAAAAAAAAAAJiWgAAAAAAAAAAA",
          networkPassphrase
        ),
      ];

      for (const tx of mockTransactions) {
        assert(isTransaction(tx));
      }
    });

    it("should verify invalid Transaction objects as false", () => {
      const mockIncorrectTransactions = [
        1 as unknown as string,
        null as unknown as string,
        undefined as unknown as string,
        {} as unknown as string,
        [] as unknown as string,
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAAfQAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAA+gAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAASwAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAw1AAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAAAAAAAAAAAAA==",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAw1AAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABy6rRnxRIjFIzSAmV8BbmxVVc8gijT2oAluc+FcWUDFAAAAAAAAAAAAJiWgAAAAAAAAAAAAAAAAAAAAAA=",
          networkPassphrase
        ),
      ];

      for (const tx of mockIncorrectTransactions) {
        assertFalse(isTransaction(tx as Transaction | FeeBumpTransaction));
      }
    });
  });

  describe("isFeeBumpTransaction", () => {
    const { networkPassphrase } = TestNet();
    it("should verify valid isFeeBumpTransaction objects as true", () => {
      const mockFeeBumpTransactions = [
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAAfQAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAA+gAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAASwAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAw1AAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAAAAAAAAAAAAA==",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAw1AAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABy6rRnxRIjFIzSAmV8BbmxVVc8gijT2oAluc+FcWUDFAAAAAAAAAAAAJiWgAAAAAAAAAAAAAAAAAAAAAA=",
          networkPassphrase
        ),
      ];

      for (const tx of mockFeeBumpTransactions) {
        assert(isFeeBumpTransaction(tx));
      }
    });

    it("should verify invalid isFeeBumpTransaction objects as false", () => {
      const mockIncorrectFeeBumpTransactions = [
        1 as unknown as string,
        null as unknown as string,
        undefined as unknown as string,
        {} as unknown as string,
        [] as unknown as string,

        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAASwAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAA=",
          networkPassphrase
        ),
        TransactionBuilder.fromXDR(
          "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABy6rRnxRIjFIzSAmV8BbmxVVc8gijT2oAluc+FcWUDFAAAAAAAAAAAAJiWgAAAAAAAAAAA",
          networkPassphrase
        ),
      ];

      for (const tx of mockIncorrectFeeBumpTransactions) {
        assertFalse(
          isFeeBumpTransaction(tx as Transaction | FeeBumpTransaction)
        );
      }
    });
  });

  describe("isSigningThreshold", () => {
    it("should verify valid signing thresholds", () => {
      const validThresholds = [0, 1, 2, 3, 127, 128, 254, 255];

      for (const threshold of validThresholds) {
        assert(isSigningThreshold(threshold));
      }
    });

    it("should verify invalid signing thresholds", () => {
      const invalidThresholds = [
        -1,
        256,
        1000,
        -100,
        1.5,
        NaN,
        Infinity,
        -Infinity,
        "0" as unknown as number,
        null as unknown as number,
        undefined as unknown as number,
        {} as unknown as number,
        [] as unknown as number,
      ];

      for (const threshold of invalidThresholds) {
        assertFalse(isSigningThreshold(threshold));
      }
    });
  });

  describe("isSmartContractTransaction", () => {
    const { networkPassphrase } = TestNet();

    it("should verify valid smart contract transactions (invokeHostFunction)", () => {
      const invokeHostFunctionTx = TransactionBuilder.fromXDR(
        "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAA=",
        networkPassphrase
      );

      assert(isSmartContractTransaction(invokeHostFunctionTx));
    });

    it("should return false for non-smart contract transactions", () => {
      const regularTx = TransactionBuilder.fromXDR(
        "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAABy6rRnxRIjFIzSAmV8BbmxVVc8gijT2oAluc+FcWUDFAAAAAAAAAAAAJiWgAAAAAAAAAAA",
        networkPassphrase
      );

      assertFalse(isSmartContractTransaction(regularTx));
    });

    it("should return false for transactions with multiple operations", () => {
      const multiOpTx = TransactionBuilder.fromXDR(
        "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAASwAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
        networkPassphrase
      );

      assertFalse(isSmartContractTransaction(multiOpTx));
    });

    it("should return false for transactions with zero operations", () => {
      const emptyOpTx = TransactionBuilder.fromXDR(
        "AAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAGQAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        networkPassphrase
      );

      assertFalse(isSmartContractTransaction(emptyOpTx));
    });

    it("should return false for fee bump transactions by default", () => {
      const feeBumpTx = TransactionBuilder.fromXDR(
        "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAw1AAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAAAAAAAAAAAAA==",
        networkPassphrase
      );

      assertFalse(isSmartContractTransaction(feeBumpTx));
    });

    it("should check inner transaction when softCheckFeebump is true", () => {
      const feeBumpTx = TransactionBuilder.fromXDR(
        "AAAABQAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAAAAAAw1AAAAAAgAAAAA89bObm+aVvEK3cX3U/qc2lQizGSbx5qcTHHdOutkcggAAwBgAAdSHAAAAAgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIZGVjaW1hbHMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAAAAfIlAAAAAAAAAAAAAAAAAAC/UAAAAAAAAAAAAAAAAA==",
        networkPassphrase
      );

      assert(isSmartContractTransaction(feeBumpTx, true));
    });

    it("should return false for invalid transaction types", () => {
      const invalidTransactions = [
        1 as unknown as Transaction,
        null as unknown as Transaction,
        undefined as unknown as Transaction,
        {} as unknown as Transaction,
        [] as unknown as Transaction,
      ];

      for (const tx of invalidTransactions) {
        assertFalse(isSmartContractTransaction(tx));
      }
    });
  });
});
