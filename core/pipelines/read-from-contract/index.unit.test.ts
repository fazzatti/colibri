import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Operation } from "stellar-sdk";
import { NetworkConfig } from "@/network/index.ts";
import * as E from "@/pipelines/read-from-contract/error.ts";
import { createReadFromContractPipeline } from "@/pipelines/read-from-contract/index.ts";
import { inputToBuild } from "@/pipelines/read-from-contract/connectors.ts";
import type { ReadFromContractInput } from "@/pipelines/read-from-contract/types.ts";
import { NetworkType } from "@/network/types.ts";

describe("createReadFromContractPipeline", () => {
  describe("Construction", () => {
    it("creates pipeline with proper name when valid config is provided", () => {
      const networkConfig: NetworkConfig = NetworkConfig.CustomNet({
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        type: NetworkType.TESTNET,
      });

      const pipeline = createReadFromContractPipeline({ networkConfig });

      assertEquals(pipeline.name, "ReadFromContractPipeline");
    });

    it("inputToBuild: converts input to BuildTransactionInput", () => {
      const networkConfig: NetworkConfig = NetworkConfig.TestNet();
      const input: ReadFromContractInput = {
        operations: [Operation.setOptions({})],
      };

      const connector = inputToBuild(networkConfig.networkPassphrase);
      assertEquals(typeof connector, "function");

      const result = connector(input);

      assertEquals(result.networkPassphrase, networkConfig.networkPassphrase);
      assertEquals(result.baseFee, "10000000");
      assertEquals(result.sequence, "1");
      assertExists(result.source);
      assertEquals(result.operations.length, 1);
      assertEquals(result.operations, input.operations);
    });
  });
  describe("Errors", () => {
    it("throws MISSING_ARG when networkConfig is missing", () => {
      assertThrows(
        () =>
          createReadFromContractPipeline({
            networkConfig: undefined as unknown as NetworkConfig,
          }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when networkPassphrase is missing", () => {
      const networkConfig = {
        rpcUrl: "https://soroban-testnet.stellar.org",
      } as NetworkConfig;

      assertThrows(
        () => createReadFromContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_RPC_URL when rpc and rpcUrl are missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createReadFromContractPipeline({ networkConfig }),
        E.MISSING_RPC_URL
      );
    });

    it("throws MISSING_ARG when both networkPassphrase and rpcUrl are missing", () => {
      const networkConfig = {} as NetworkConfig;

      assertThrows(
        () => createReadFromContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws UNEXPECTED_ERROR when an unknown error occurs", () => {
      const networkConfig: NetworkConfig = NetworkConfig.CustomNet({
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "a", // invalid URL to trigger error
        type: NetworkType.TESTNET,
      });
      assertThrows(
        () => createReadFromContractPipeline({ networkConfig }),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
