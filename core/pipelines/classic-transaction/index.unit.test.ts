import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createRunContext, step } from "convee";
import { Operation } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";

import { NetworkConfig } from "@/network/index.ts";
import * as E from "@/pipelines/classic-transaction/error.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import type { ClassicTransactionInput } from "@/pipelines/classic-transaction/types.ts";
import {
  CLASSIC_TRANSACTION_INPUT_STEP_ID,
  envSignReqToSignEnvelope,
  inputToBuild,
  signEnvelopeToSendTransaction,
} from "@/pipelines/classic-transaction/connectors.ts";
import type { EnvelopeSigningRequirementsOutput } from "@/processes/envelope-signing-requirements/types.ts";
import type { SignEnvelopeOutput } from "@/processes/sign-envelope/types.ts";
import { NetworkType } from "@/network/types.ts";
import { BUILD_TRANSACTION_STEP_ID } from "@/steps/index.ts";
import { HashXSigner } from "@/signer/hash-x/index.ts";

const seedStepOutput = async <Output>(
  context: ReturnType<typeof createRunContext>,
  stepId: string,
  output: Output,
) => {
  const seedStep = step(() => output, { id: stepId });
  await seedStep.runWith({ context: { parent: context } });
};

describe("createClassicTransactionPipeline", () => {
  describe("Construction", () => {
    it("creates pipeline with proper name when valid config is provided", () => {
      const networkConfig: NetworkConfig = NetworkConfig.CustomNet({
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        type: NetworkType.TESTNET,
      });

      const pipeline = createClassicTransactionPipeline({ networkConfig });

      assertEquals(pipeline.id, "ClassicTransactionPipeline");
    });

    it("accepts HTTP rpcUrl when allowHttp is true", () => {
      const networkConfig: NetworkConfig = NetworkConfig.CustomNet({
        networkPassphrase: "Standalone Network ; February 2017",
        rpcUrl: "http://127.0.0.1:8000/rpc",
        allowHttp: true,
        type: NetworkType.TESTNET,
      });

      const pipeline = createClassicTransactionPipeline({ networkConfig });

      assertEquals(pipeline.id, "ClassicTransactionPipeline");
    });

    it("preserves the caller input at the pipeline boundary", async () => {
      const networkConfig = NetworkConfig.TestNet();
      const pipeline = createClassicTransactionPipeline({
        networkConfig,
        rpc: {} as Server,
      });
      const input: ClassicTransactionInput = {
        operations: [Operation.setOptions({})],
        config: {
          fee: "100",
          source: "GMOCKEDSOURCE",
          timeout: 30,
          signers: [],
        },
      };

      assertEquals(await pipeline.steps[0](input), input);
    });
  });

  describe("Connectors", () => {
    describe("inputToBuild", () => {
      it("transforms input to BuildTransactionInput", () => {
        const networkConfig = NetworkConfig.TestNet();
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
          networkConfig.networkPassphrase,
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

      it("forwards configured extra signer keys as transaction preconditions", () => {
        const networkConfig = NetworkConfig.TestNet();
        const mockRpc = {} as unknown as Server;
        const extraSigner = HashXSigner.fromPreimage(new Uint8Array([1]));
        const input: ClassicTransactionInput = {
          operations: [Operation.setOptions({})],
          config: {
            fee: "100",
            source: "GMOCKEDSOURCE",
            timeout: 30,
            signers: [],
            extraSigners: [extraSigner.signerKey()],
          },
        };

        const result = inputToBuild(
          mockRpc,
          networkConfig.networkPassphrase,
        )(input);

        assertEquals(result.preconditions, {
          extraSigners: [extraSigner.signerKey()],
        });
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

        const context = createRunContext();
        await seedStepOutput(
          context,
          BUILD_TRANSACTION_STEP_ID,
          mockBuildOutput,
        );
        await seedStepOutput(
          context,
          CLASSIC_TRANSACTION_INPUT_STEP_ID,
          mockInputStep,
        );

        const connector = envSignReqToSignEnvelope();

        const result = await connector.runWith(
          { context: { parent: context } },
          ...mockEnvelopeSigningReqOutput,
        );

        assertExists(result);
        assertEquals(
          result.signatureRequirements,
          mockEnvelopeSigningReqOutput,
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
  });
  describe("Errors", () => {
    it("throws MISSING_ARG when networkConfig is missing", () => {
      assertThrows(
        () =>
          createClassicTransactionPipeline({
            networkConfig: undefined as unknown as NetworkConfig,
          }),
        E.MISSING_ARG,
      );
    });

    it("throws MISSING_ARG when networkPassphrase is missing", () => {
      const networkConfig = {
        rpcUrl: "https://soroban-testnet.stellar.org",
      } as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_ARG,
      );
    });

    it("throws MISSING_RPC_URL when rpc and rpcUrl are missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_RPC_URL,
      );
    });

    it("throws MISSING_ARG when both networkPassphrase and rpcUrl are missing", () => {
      const networkConfig = {} as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_ARG,
      );
    });

    it("throws UNEXPECTED_ERROR when an unknown error occurs", () => {
      const networkConfig: NetworkConfig = NetworkConfig.CustomNet({
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "a", // invalid URL to trigger error
        type: NetworkType.TESTNET,
      });
      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.UNEXPECTED_ERROR,
      );
    });
  });
});
