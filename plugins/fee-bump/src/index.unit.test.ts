// deno-lint-ignore-file no-explicit-any
import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { Api, Server } from "stellar-sdk/rpc";
import { pipe, step } from "convee";
import {
  createInvokeContractPipeline,
  INVOKE_CONTRACT_PIPELINE_ID,
  isFeeBumpTransaction,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type SendTransactionInput,
  type SendTransactionOutput,
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

type PluginInput = SendTransactionInput;

describe("FeeBump Plugin", () => {
  const CREATED_AT = 1_710_000_000;
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

  const createPluginTestPipe = (onInput?: (input: PluginInput) => void) =>
    pipe(
      [
        step(
          (input: PluginInput): SendTransactionOutput => {
            onInput?.(input);
            return {
              hash: "mock-hash",
              ledger: 12345,
              createdAt: CREATED_AT,
              returnValue: undefined,
              response: {} as Api.GetSuccessfulTransactionResponse,
            };
          },
          {
            id: steps.SEND_TRANSACTION_STEP_ID,
          },
        ),
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
        invokePipe.plugins as unknown as readonly (typeof plugin)[],
      );
      assertExists(attachedPlugin);
      assertEquals(attachedPlugin.id, FEE_BUMP_PLUGIN_ID);
      assertEquals(attachedPlugin.target, FEE_BUMP_PLUGIN_TARGET);
    });
  });

  describe("Execute", () => {
    it("wraps a transaction in a fee bump transaction", async () => {
      const plugin = createPlugin();
      const received: { input?: PluginInput } = {};
      const pluginPipe = createPluginTestPipe((input) => {
        received.input = input;
      });
      pluginPipe.use(plugin);
      const mockTransaction = createTestTransaction();

      const result = await pluginPipe({
        transaction: mockTransaction,
        rpc: {} as any,
      });

      assertExists(result);
      const interceptedInput = received.input;
      if (!interceptedInput) {
        throw new Error("Expected the fee-bump plugin to reach the step input");
      }
      assertEquals(isFeeBumpTransaction(interceptedInput.transaction), true);
      assertEquals(
        (interceptedInput.transaction as FeeBumpTransaction).feeSource,
        feeBumpSource.address(),
      );
      assertEquals(interceptedInput.transaction.fee, "20000000");
      assertEquals(
        (
          interceptedInput.transaction as FeeBumpTransaction
        ).innerTransaction.toXDR(),
        mockTransaction.toXDR(),
      );
    });

    it("preserves non-transaction input fields", async () => {
      const plugin = createPlugin();
      const received: { input?: PluginInput } = {};
      const pluginPipe = createPluginTestPipe((input) => {
        received.input = input;
      });
      pluginPipe.use(plugin);
      const mockTransaction = createTestTransaction();
      const mockRpc = { someRpcProperty: true } as any;

      const result = await pluginPipe({
        transaction: mockTransaction,
        rpc: mockRpc,
      });

      assertExists(result);
      const interceptedInput = received.input;
      if (!interceptedInput) {
        throw new Error("Expected the fee-bump plugin to reach the step input");
      }
      assertEquals(interceptedInput.rpc, mockRpc);
      assertEquals(interceptedInput.transaction !== mockTransaction, true);
      assertEquals(isFeeBumpTransaction(interceptedInput.transaction), true);
    });
  });

  describe("Error Handling", () => {
    it("uses the plugin package identifier as the error source", () => {
      const error = new E.MISSING_ARG("networkConfig");

      assertEquals(error.source, "@colibri/plugin-fee-bump");
    });

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
