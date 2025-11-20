import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Operation, xdr } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";

import { type NetworkConfig, NetworkType, TestNet } from "@/network/index.ts";
import * as E from "@/pipelines/classic-transaction/error.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import type { ClassicTransactionInput } from "@/pipelines/classic-transaction/types.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  sendTransactionToPipeOutput,
  signEnvelopeToSendTransaction,
} from "@/pipelines/classic-transaction/connectors.ts";
import type { EnvelopeSigningRequirementsOutput } from "@/processes/envelope-signing-requirements/types.ts";
import { MetadataHelper } from "convee";
import type { SignEnvelopeOutput } from "@/processes/sign-envelope/types.ts";
import type { SendTransactionOutput } from "@/processes/send-transaction/types.ts";

describe("createClassicTransactionPipeline", () => {
  describe("Construction", () => {
    it("creates pipeline with proper name when valid config is provided", () => {
      const networkConfig: NetworkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        type: NetworkType.TESTNET,
      };

      const pipeline = createClassicTransactionPipeline({ networkConfig });

      assertEquals(pipeline.name, "ClassicTransactionPipeline");
    });
  });

  describe("Connectors", () => {
    describe("inputToBuild", () => {
      it("transforms input to BuildTransactionInput", () => {
        const networkConfig = TestNet();
        const mockRpc = {} as unknown as Server;
        const input: ClassicTransactionInput = {
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

    describe("envSignReqToSignEnvelope", () => {
      it("transforms EnvelopeSigningRequirementsOutput to SignEnvelopeInput", async () => {
        const mockEnvelopeSigningReqOutput: EnvelopeSigningRequirementsOutput =
          [];

        const mockBuildOutput = {
          /* mock build transaction output */
        };

        const mockInputStep: ClassicTransactionInput = {
          operations: [],
          config: {
            fee: "100",
            source: "GCFX...",
            timeout: 30,
            signers: [],
          },
        };

        const metadata = new MetadataHelper();
        metadata.add("buildKey", mockBuildOutput);
        metadata.add("inputKey", mockInputStep);

        const connector = envSignReqToSignEnvelope("buildKey", "inputKey");

        const result = await connector(mockEnvelopeSigningReqOutput, metadata);

        assertExists(result);
        assertEquals(
          result.signatureRequirements,
          mockEnvelopeSigningReqOutput
        );
        assertEquals(result.transaction, mockBuildOutput);
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

    describe("sendTransactionToPipeOutput", () => {
      it("transforms SendTransactionOutput to ClassicTransactionOutput", async () => {
        const mockSendOutput: SendTransactionOutput = {
          hash: "mock-hash-123",
          returnValue: xdr.ScVal.scvVoid(),
          response: {} as unknown as Api.GetSuccessfulTransactionResponse,
        };

        const result = await sendTransactionToPipeOutput(mockSendOutput);

        assertExists(result);
        assertEquals(result.hash, "mock-hash-123");
        assertEquals(result.response, mockSendOutput.response);
      });
    });
  });
  describe("Errors", () => {
    it("throws MISSING_ARG when networkConfig is missing", () => {
      assertThrows(
        () =>
          createClassicTransactionPipeline({
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
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_RPC_URL when rpc and rpcUrl are missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_RPC_URL
      );
    });

    it("throws MISSING_ARG when both networkPassphrase and rpcUrl are missing", () => {
      const networkConfig = {} as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
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
        () => createClassicTransactionPipeline({ networkConfig }),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
