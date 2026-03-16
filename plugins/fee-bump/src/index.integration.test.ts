import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals, assertExists } from "@std/assert";
import { afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { Asset, Operation } from "stellar-sdk";
import { Api } from "stellar-sdk/rpc";
import {
  initializeWithFriendbot,
  NativeAccount,
  LocalSigner,
  type Ed25519PublicKey,
} from "@colibri/core/";
import { PLG_FeeBump } from "@/index.ts";
import {
  NetworkConfig,
  PIPE_InvokeContract,
  type TransactionConfig,
  steps,
} from "@colibri/core";

describe(
  "[Testnet] FeeBump Plugin",
  disableSanitizeConfig,

  () => {
    const networkConfig = NetworkConfig.TestNet();

    const xlmContractId = Asset.native().contractId(
      networkConfig.networkPassphrase
    );

    let invokePipe: ReturnType<typeof PIPE_InvokeContract.create> | undefined =
      undefined;
    // Inner tx source and fee-bump payer
    const innerSource = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom()
    );
    const feeBumpSource = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom()
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

      invokePipe = PIPE_InvokeContract.create({
        networkConfig,
      });
    });

    afterEach(() => {
      invokePipe = undefined;
    });

    describe("Construction", () => {
      it("should initialize the plugin", () => {
        const plugin = PLG_FeeBump.create({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        assertExists(plugin);
        assertEquals(plugin.id, PLG_FeeBump.name);
      });

      it("should add the plugin to the SendTransaction process", () => {
        const plugin = PLG_FeeBump.create({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
            fee: "10000000", // 1XLM
            signers: [feeBumpSource.signer()],
          },
        });

        invokePipe = PIPE_InvokeContract.create({
          networkConfig,
        });

        assertEquals(invokePipe.plugins.length, 0);
        invokePipe.use(plugin);

        assertExists(invokePipe);
        assertEquals(invokePipe.id, PIPE_InvokeContract.name);
        assertEquals(invokePipe.plugins.length, 1);
        const [attachedPlugin] = Array.from(
          invokePipe.plugins as unknown as readonly typeof plugin[],
        );
        assertExists(attachedPlugin);
        assertEquals(attachedPlugin.id, PLG_FeeBump.name);
        assertEquals(attachedPlugin.target, steps.SEND_TRANSACTION_STEP_ID);
      });
    });
    describe("Execute", () => {
      it("should wrap and run a successful fee bump transaction", async () => {
        const plugin = PLG_FeeBump.create({
          networkConfig,
          feeBumpConfig: {
            source: feeBumpSource.address(),
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
        assertEquals(plugin.id, "FeeBumpPlugin");

        invokePipe = PIPE_InvokeContract.create({
          networkConfig,
        });
        assertEquals(invokePipe.plugins.length, 0);
        invokePipe.use(plugin);

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
      });
    });
  }
);
