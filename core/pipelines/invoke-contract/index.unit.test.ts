import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { type NetworkConfig, NetworkType } from "../../network/index.ts";
import * as E from "./error.ts";
import { createInvokeContractPipeline } from "./index.ts";
import type { SimulateTransactionOutput } from "../../processes/simulate-transaction/types.ts";
import { simulateToSignAuthEntries } from "./connectors.ts";
import type { Server } from "stellar-sdk/rpc";
import { MetadataHelper } from "convee";
import { SorobanDataBuilder, xdr } from "stellar-sdk";

describe("createInvokeContractPipeline", () => {
  describe("Construction", () => {
    it("creates pipeline with proper name when valid config is provided", () => {
      const networkConfig: NetworkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        type: NetworkType.TESTNET,
      };

      const pipeline = createInvokeContractPipeline({ networkConfig });

      assertEquals(pipeline.name, "InvokeContractPipeline");
    });
  });

  describe("Connectors", () => {
    describe("simulateToSignAuthEntries", () => {
      it("simulates signing of authorization entries", async () => {
        const mockSimulateOutput: SimulateTransactionOutput = {
          id: "1",
          minResourceFee: "1",
          latestLedger: 1,
          events: [],
          _parsed: true,
          result: {
            auth: [],
            retval: xdr.ScVal.scvVoid(),
          },
          transactionData: new SorobanDataBuilder(),
        };

        const mockRpc = {} as unknown as Server;
        const mockNetworkPassphrase = "mockNetworkPassphrase";
        const connector = simulateToSignAuthEntries(
          "key",
          mockRpc,
          mockNetworkPassphrase
        );

        const metadata = new MetadataHelper();

        metadata.add("key", {
          operations: [],
          config: {
            fee: "100",
            source: "GCFX...",
            signers: [],
          },
        });

        const result = await connector(mockSimulateOutput, metadata);

        assertExists(result);
        assertEquals(result, {
          auth: [],
          signers: [],
          rpc: mockRpc,
          networkPassphrase: mockNetworkPassphrase,
        });
      });

      it("handles missing auth entries and signers", async () => {
        const mockSimulateOutput: SimulateTransactionOutput = {
          id: "1",
          minResourceFee: "1",
          latestLedger: 1,
          events: [],
          _parsed: true,
          result: {
            retval: xdr.ScVal.scvVoid(),
          },
          transactionData: new SorobanDataBuilder(),
        } as unknown as SimulateTransactionOutput;

        const mockRpc = {} as unknown as Server;
        const mockNetworkPassphrase = "mockNetworkPassphrase";
        const connector = simulateToSignAuthEntries(
          "key",
          mockRpc,
          mockNetworkPassphrase
        );

        const metadata = new MetadataHelper();

        metadata.add("key", {
          operations: [],
          config: {
            fee: "100",
            source: "GCFX...",
          },
        });

        const result = await connector(mockSimulateOutput, metadata);

        assertExists(result);
        assertEquals(result, {
          auth: [],
          signers: [],
          rpc: mockRpc,
          networkPassphrase: mockNetworkPassphrase,
        });
      });
    });
  });
  describe("Errors", () => {
    it("throws MISSING_ARG when networkConfig is missing", () => {
      assertThrows(
        () =>
          createInvokeContractPipeline({
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
        () => createInvokeContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when rpcUrl is missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createInvokeContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when both networkPassphrase and rpcUrl are missing", () => {
      const networkConfig = {} as NetworkConfig;

      assertThrows(
        () => createInvokeContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws UNEXPECTED_ERROR when an unknown error occurs", () => {
      const networkConfig: NetworkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "a", // invalid URL to trigger error
        type: NetworkType.TESTNET,
      };
      assertThrows(
        () => createInvokeContractPipeline({ networkConfig }),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
