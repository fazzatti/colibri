// deno-lint-ignore-file no-explicit-any
import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { Server } from "stellar-sdk/rpc";
import { pipe, step } from "convee";
import {
  createInvokeContractPipeline,
  INVOKE_CONTRACT_PIPELINE_ID,
  isFeeBumpTransaction,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  steps,
} from "@colibri/core";
import {
  createFeeBumpPlugin,
  FEE_BUMP_PLUGIN_ID,
  FEE_BUMP_PLUGIN_TARGET,
} from "@/index.ts";
import * as E from "@/error.ts";
import {
  Account,
  type FeeBumpTransaction,
  Operation,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import type { PluginInput } from "@/types.ts";

describe("FeeBump Plugin", () => {
  const networkConfig = NetworkConfig.TestNet();

  const innerSource = NativeAccount.fromMasterSigner(
    LocalSigner.generateRandom(),
  );
  const feeBumpSource = NativeAccount.fromMasterSigner(
    LocalSigner.generateRandom(),
  );

  const createTestTransaction = () => {
    const sourceAcc = new Account(innerSource.address(), "100");
    const txb = new TransactionBuilder(sourceAcc, {
      fee: "100",
      networkPassphrase: networkConfig.networkPassphrase,
    });
    txb.addOperation(Operation.setOptions({}));
    txb.setTimeout(0);
    return txb.build();
  };

  const createPlugin = () =>
    createFeeBumpPlugin({
      networkConfig,
      feeBumpConfig: {
        source: feeBumpSource.address(),
        fee: "10000000",
        signers: [feeBumpSource.signer()],
      },
    });

  const createPluginTestPipe = () =>
    pipe(
      [
        step((input: PluginInput) => input, {
          id: steps.SEND_TRANSACTION_STEP_ID,
        }),
      ] as const,
      { id: "FeeBumpPluginTestPipe" as const },
    );

  describe("Construction", () => {
    it("initializes the plugin with the expected id and target", () => {
      const plugin = createPlugin();

      assertExists(plugin);
      assertEquals(plugin.id, FEE_BUMP_PLUGIN_ID);
      assertEquals(plugin.target, FEE_BUMP_PLUGIN_TARGET);
    });

    it("attaches the plugin to the invoke pipeline", () => {
      const plugin = createPlugin();
      const invokePipe = createInvokeContractPipeline({ networkConfig });

      invokePipe.use(plugin);

      assertExists(invokePipe);
      assertEquals(invokePipe.id, INVOKE_CONTRACT_PIPELINE_ID);
      assertEquals(invokePipe.plugins.length, 1);
      const [attachedPlugin] = Array.from(
        invokePipe.plugins as unknown as readonly typeof plugin[],
      );
      assertExists(attachedPlugin);
      assertEquals(attachedPlugin.id, FEE_BUMP_PLUGIN_ID);
      assertEquals(attachedPlugin.target, FEE_BUMP_PLUGIN_TARGET);
    });
  });

  describe("Execute", () => {
    it("wraps a transaction in a fee bump transaction", async () => {
      const plugin = createPlugin();
      const pluginPipe = createPluginTestPipe();
      pluginPipe.use(plugin);
      const mockTransaction = createTestTransaction();

      const result = await pluginPipe({
        transaction: mockTransaction,
        rpc: {} as any,
      });

      assertExists(result);
      assertExists(result.transaction);
      assertEquals(isFeeBumpTransaction(result.transaction), true);
      assertEquals(
        (result.transaction as FeeBumpTransaction).feeSource,
        feeBumpSource.address(),
      );
      assertEquals(result.transaction.fee, "20000000");
      assertEquals(
        (result.transaction as FeeBumpTransaction).innerTransaction.toXDR(),
        mockTransaction.toXDR(),
      );
    });

    it("preserves non-transaction input fields", async () => {
      const plugin = createPlugin();
      const pluginPipe = createPluginTestPipe();
      pluginPipe.use(plugin);
      const mockTransaction = createTestTransaction();
      const mockRpc = { someRpcProperty: true } as any;

      const result = await pluginPipe({
        transaction: mockTransaction,
        rpc: mockRpc,
      });

      assertExists(result);
      assertEquals(result.rpc, mockRpc);
      assertEquals(result.transaction !== mockTransaction, true);
      assertEquals(isFeeBumpTransaction(result.transaction), true);
    });
  });

  describe("Error Handling", () => {
    it("throws NOT_A_TRANSACTION for invalid input", async () => {
      const plugin = createPlugin();
      const pluginPipe = createPluginTestPipe();
      pluginPipe.use(plugin);
      const mockRpc = {} as unknown as Server;
      const mockTx = {} as unknown as Transaction;

      await assertRejects(
        async () =>
          await pluginPipe({
            transaction: mockTx,
            rpc: mockRpc,
          } as PluginInput),
        E.NOT_A_TRANSACTION,
      );

      await assertRejects(
        async () =>
          await pluginPipe({
            transaction: "not a transaction" as any,
            rpc: mockRpc,
          }),
        E.NOT_A_TRANSACTION,
      );
    });

    it("throws MISSING_ARG when required creation arguments are missing", () => {
      assertThrows(
        () =>
          createFeeBumpPlugin({
            networkConfig,
          } as any),
        E.MISSING_ARG,
      );

      assertThrows(
        () =>
          createFeeBumpPlugin({
            feeBumpConfig: {
              source: feeBumpSource.address(),
              fee: "10000000",
              signers: [feeBumpSource.signer()],
            },
          } as any),
        E.MISSING_ARG,
      );
    });

    it("propagates pipeline creation validation errors", () => {
      assertThrows(
        () =>
          createFeeBumpPlugin({
            networkConfig: null as unknown as NetworkConfig,
            feeBumpConfig: {
              source: feeBumpSource.address(),
              fee: "10000000",
              signers: [feeBumpSource.signer()],
            } as any,
          }),
        E.UNEXPECTED_ERROR,
      );
    });
  });
});
