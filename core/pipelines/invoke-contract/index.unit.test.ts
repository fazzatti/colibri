import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { MetadataHelper } from "convee";
import { Operation, SorobanDataBuilder, xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { type NetworkConfig, NetworkType, TestNet } from "@/network/index.ts";
import * as E from "./error.ts";
import { createInvokeContractPipeline } from "@/pipelines/invoke-contract/index.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import {
  inputToBuild,
  signAuthEntriesToAssemble,
  simulateToSignAuthEntries,
  envSignReqToSignEnvelope,
  signEnvelopeToSendTransaction,
} from "@/pipelines/invoke-contract/connectors.ts";
import type { InvokeContractInput } from "@/pipelines/invoke-contract/types.ts";
import type { EnvelopeSigningRequirementsOutput } from "@/processes/envelope-signing-requirements/types.ts";
import type { SignEnvelopeOutput } from "@/processes/sign-envelope/types.ts";

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
    describe("inputToBuild", () => {
      it("transforms input to BuildTransactionInput", () => {
        const networkConfig = TestNet();
        const mockRpc = {} as unknown as Server;
        const input: InvokeContractInput = {
          operations: [Operation.setOptions({})],
          config: {
            fee: "10000000",
            source: "GMOCKEDSOURCE",
            timeout: 30,
            signers: [],
          },
        };

        const connector = inputToBuild(
          mockRpc,
          networkConfig.networkPassphrase
        );
        assertEquals(typeof connector, "function");

        const result = connector(input);

        assertExists(result);
        assertEquals(result.baseFee, "10000000");
        assertEquals(result.networkPassphrase, networkConfig.networkPassphrase);
        assertEquals(result.operations, input.operations);
        assertExists(result.source);
        assertEquals(result.rpc, mockRpc);
      });
    });

    describe("signAuthEntriesToAssemble", () => {
      it("transforms SignAuthEntriesOutput to AssembleTransactionInput", async () => {
        const mockSignAuthEntriesOutput = [
          "mock-1",
          "mock-2",
        ] as unknown as xdr.SorobanAuthorizationEntry[];

        const mockBuildOutput = {
          /* mock transaction */
        };

        const mockSimulateOutput: SimulateTransactionOutput = {
          id: "1",
          minResourceFee: "5000",
          latestLedger: 1,
          events: [],
          _parsed: true,
          result: {
            auth: [],
            retval: xdr.ScVal.scvVoid(),
          },
          transactionData: new SorobanDataBuilder(),
        };

        const metadata = new MetadataHelper();
        metadata.add("buildKey", mockBuildOutput);
        metadata.add("simulateKey", mockSimulateOutput);

        const connector = signAuthEntriesToAssemble("buildKey", "simulateKey");

        const result = await connector(mockSignAuthEntriesOutput, metadata);

        assertExists(result);
        assertEquals(result.authEntries, mockSignAuthEntriesOutput);
        assertEquals(result.transaction, mockBuildOutput);
        assertEquals(result.sorobanData, mockSimulateOutput.transactionData);
        assertEquals(result.resourceFee, 5000);
      });
    });
    describe("envSignReqToSignEnvelope", () => {
      it("transforms EnvelopeSigningRequirementsOutput to SignEnvelopeInput", async () => {
        const mockEnvelopeSigningReqOutput: EnvelopeSigningRequirementsOutput =
          [];

        const mockAssembleOutput = {
          /* mock assembled transaction */
        };

        const mockInputStep: InvokeContractInput = {
          operations: [],
          config: {
            fee: "100",
            source: "GCFX...",
            timeout: 30,
            signers: [],
          },
        };

        const metadata = new MetadataHelper();
        metadata.add("assembleKey", mockAssembleOutput);
        metadata.add("inputKey", mockInputStep);

        const connector = envSignReqToSignEnvelope("assembleKey", "inputKey");

        const result = await connector(mockEnvelopeSigningReqOutput, metadata);

        assertExists(result);
        assertEquals(
          result.signatureRequirements,
          mockEnvelopeSigningReqOutput
        );
        assertEquals(result.transaction, mockAssembleOutput);
        assertEquals(result.signers, mockInputStep.config.signers);
      });
    });

    describe("signEnvelopeToSendTransaction", () => {
      it("transforms SignEnvelopeOutput to SendTransactionInput", async () => {
        const mockRpc = {} as unknown as Server;
        const mockSignEnvelopeOutput: SignEnvelopeOutput = {
          /* mock signed transaction */
        } as unknown as SignEnvelopeOutput;

        const connector = signEnvelopeToSendTransaction(mockRpc);

        const result = await connector(mockSignEnvelopeOutput);

        assertExists(result);
        assertEquals(result.transaction, mockSignEnvelopeOutput);
        assertEquals(result.rpc, mockRpc);
      });
    });

    describe("simulateToSignAuthEntries", () => {
      it("converts simulate output to sign auth entries input", async () => {
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

    it("throws MISSING_RPC_URL when rpc and rpcUrl are missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createInvokeContractPipeline({ networkConfig }),
        E.MISSING_RPC_URL
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
