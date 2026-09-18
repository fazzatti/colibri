import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  Asset,
  FeeBumpTransaction,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import { Api } from "stellar-sdk/rpc";
import {
  type Ed25519PublicKey,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
} from "@colibri/core";
import { createFeeBumpPlugin, FEE_BUMP_PLUGIN_ID } from "@/index.ts";
import {
  createInvokeContractPipeline,
  INVOKE_CONTRACT_PIPELINE_ID,
  NetworkConfig,
  steps,
  type TransactionConfig,
} from "@colibri/core";

const { afterEach, beforeAll, describe, it, observer: suiteObserver } =
  recordColibriTests(import.meta.url);

describe(
  "[Testnet] FeeBump Plugin",
  disableSanitizeConfig,
  () => {
    const networkConfig = NetworkConfig.TestNet();

    const xlmContractId = Asset.native().contractId(
      networkConfig.networkPassphrase,
    );

    let invokePipe:
      | ReturnType<typeof createInvokeContractPipeline>
      | undefined = undefined;
    // Inner tx source and fee-bump payer
    const innerSource = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const feeBumpSource = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );

    beforeAll(async () => {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        innerSource.address() as Ed25519PublicKey,
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );
      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        feeBumpSource.address() as Ed25519PublicKey,
        {
          rpcUrl: networkConfig.rpcUrl,
          allowHttp: networkConfig.allowHttp,
        },
      );

      invokePipe = suiteObserver.attach(
        createInvokeContractPipeline({
          networkConfig,
        }),
        { name: "invokePipe" },
      );
    });

    afterEach(() => {
      invokePipe = undefined;
    });

    describe("Construction", () => {
      it("should initialize the plugin", () => {
        const plugin = createFeeBumpPlugin({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        assertExists(plugin);
        assertEquals(plugin.id, FEE_BUMP_PLUGIN_ID);
      });

      it("should add the plugin to the SendTransaction process", () => {
        const plugin = createFeeBumpPlugin({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        invokePipe = createInvokeContractPipeline({ networkConfig });

        assertEquals(invokePipe.plugins.length, 0);
        invokePipe.use(plugin);

        assertExists(invokePipe);
        assertEquals(invokePipe.id, INVOKE_CONTRACT_PIPELINE_ID);
        assertEquals(invokePipe.plugins.length, 1);
        const [attachedPlugin] = Array.from(
          invokePipe.plugins as unknown as readonly typeof plugin[],
        );
        assertExists(attachedPlugin);
        assertEquals(attachedPlugin.id, FEE_BUMP_PLUGIN_ID);
        assertEquals(attachedPlugin.target, steps.SEND_TRANSACTION_STEP_ID);
        // Inspect the plugin's own composition before adding observation plugins.
        suiteObserver.attach(invokePipe, { name: "invokePipe" });
      });
    });
    describe("Execute", () => {
      it("should wrap and run a successful fee bump transaction", async () => {
        const muxedFeeSource = feeBumpSource.muxedAddress("123");
        const plugin = createFeeBumpPlugin({
          networkConfig,
          feeBumpConfig: {
            source: muxedFeeSource,
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        const innerConfig: TransactionConfig = {
          source: innerSource.address(),
          fee: "100",
          timeout: 30,
          signers: [innerSource.signer()],
        };
        assertExists(plugin);
        assertEquals(plugin.id, FEE_BUMP_PLUGIN_ID);

        invokePipe = createInvokeContractPipeline({ networkConfig });
        assertEquals(invokePipe.plugins.length, 0);
        invokePipe.use(plugin);
        // Install the recorder after the fee-bump plugin to observe its output.
        suiteObserver.attach(invokePipe, { name: "invokePipe" });

        const decimalsOp = Operation.invokeContractFunction({
          function: "decimals",
          contract: xlmContractId,
          args: [],
        });

        const res = await invokePipe.run({
          operations: [decimalsOp],
          config: innerConfig,
        });
        assertExists(res);
        assertExists(res.hash);
        assertExists(res.response);
        assertEquals(res.response.status, Api.GetTransactionStatus.SUCCESS);
        const submittedTransaction = TransactionBuilder.fromXDR(
          res.response.envelopeXdr,
          networkConfig.networkPassphrase,
        );
        assertInstanceOf(submittedTransaction, FeeBumpTransaction);
        assertEquals(submittedTransaction.feeSource, muxedFeeSource);
      });
    });
  },
);
