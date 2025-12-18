// // deno-lint-ignore-file no-explicit-any
// import { assertEquals, assertExists } from "@std/assert";
// import { describe, it } from "@std/testing/bdd";
// import type { Server } from "stellar-sdk/rpc";
// import {
//   PIPE_InvokeContract,
//   P_SendTransaction,
//   isFeeBumpTransaction,
//   NativeAccount,
//   LocalSigner,
//   NetworkConfig,
// } from "@colibri/core";
// import { PLG_FeeBump } from "@/index.ts";
// import * as E from "@/error.ts";
// import {
//   Operation,
//   TransactionBuilder,
//   Account,
//   type FeeBumpTransaction,
//   type Transaction,
// } from "stellar-sdk";
// import { assertRejects } from "@std/assert";
// import type { PluginInput } from "@/types.ts";

// describe("FeeBump Plugin", () => {
//   const networkConfig = NetworkConfig.TestNet();

//   // Use the same account pattern as the integration test
//   const innerSource = NativeAccount.fromMasterSigner(
//     LocalSigner.generateRandom()
//   );
//   const feeBumpSource = NativeAccount.fromMasterSigner(
//     LocalSigner.generateRandom()
//   );

//   // Helper function to create a test transaction
//   const createTestTransaction = () => {
//     // Use a hardcoded sequence number for unit testing
//     const sourceAcc = new Account(innerSource.address(), "100");
//     const txb = new TransactionBuilder(sourceAcc, {
//       fee: "100",
//       networkPassphrase: networkConfig.networkPassphrase,
//     });
//     txb.addOperation(Operation.setOptions({}));
//     txb.setTimeout(0);
//     return txb.build();
//   };

//   describe("Construction", () => {
//     it("should initialize the plugin", () => {
//       const plugin = PLG_FeeBump.create({
//         networkConfig,
//         feeBumpConfig: {
//           source: feeBumpSource.address(),
//           fee: "10000000", // 1XLM
//           signers: [feeBumpSource.signer()],
//         },
//       });

//       assertExists(plugin);
//       assertEquals(plugin.name, PLG_FeeBump.name);
//     });

//     it("should add the plugin to the SendTransaction process", () => {
//       const plugin = PLG_FeeBump.create({
//         networkConfig,
//         feeBumpConfig: {
//           source: feeBumpSource.address(),
//           fee: "10000000", // 1XLM
//           signers: [feeBumpSource.signer()],
//         },
//       });

//       const invokePipe = PIPE_InvokeContract.create({
//         networkConfig,
//       });

//       invokePipe.addPlugin(plugin, PLG_FeeBump.target);

//       assertExists(invokePipe);
//       assertEquals(invokePipe.name, PIPE_InvokeContract.name);

//       const SendTransactionStep = P_SendTransaction();

//       const sendTransactionStepInPipe = invokePipe.steps.find(
//         (step) => step.name === PLG_FeeBump.target
//       ) as typeof SendTransactionStep;

//       assertExists(sendTransactionStepInPipe);
//       assertExists(sendTransactionStepInPipe.plugins);
//       assertEquals(sendTransactionStepInPipe.plugins.length, 1);
//       assertEquals(sendTransactionStepInPipe.plugins[0].name, PLG_FeeBump.name);
//     });
//   });

//   describe("Execute", () => {
//     it("should wrap a transaction in a fee bump transaction", async () => {
//       const plugin = PLG_FeeBump.create({
//         networkConfig,
//         feeBumpConfig: {
//           source: feeBumpSource.address(),
//           fee: "10000000", // 1XLM
//           signers: [feeBumpSource.signer()],
//         },
//       });

//       assertExists(plugin);
//       assertEquals(plugin.name, "FeeBumpPlugin");

//       // Create a transaction to wrap
//       const mockTransaction = createTestTransaction();

//       // Process the transaction through the plugin
//       const result = await plugin.processInput({
//         transaction: mockTransaction,
//         rpc: {} as any, // Mock RPC for unit test
//       });

//       // Verify the result
//       assertExists(result);
//       assertExists(result.transaction);
//       assertEquals(isFeeBumpTransaction(result.transaction), true);

//       // Check it's a fee bump transaction with the right properties
//       assertEquals(
//         (result.transaction as FeeBumpTransaction).feeSource,
//         feeBumpSource.address()
//       );
//       assertEquals(result.transaction.fee, "20000000"); // it multiplies by 2 as the fee bump is considered a second operation
//       assertEquals(isFeeBumpTransaction(result.transaction), true);

//       // Check the inner transaction matches what we provided
//       assertEquals(
//         (result.transaction as FeeBumpTransaction).innerTransaction.toXDR(),
//         mockTransaction.toXDR()
//       );
//     });

//     it("should preserve other properties in the input", async () => {
//       const plugin = PLG_FeeBump.create({
//         networkConfig,
//         feeBumpConfig: {
//           source: feeBumpSource.address(),
//           fee: "10000000", // 1XLM
//           signers: [feeBumpSource.signer()],
//         },
//       });

//       // Create a transaction and input object
//       const mockTransaction = createTestTransaction();
//       const mockRpc = { someRpcProperty: true } as any;

//       const input = {
//         transaction: mockTransaction,
//         rpc: mockRpc,
//       };

//       // Process the transaction
//       const result = await plugin.processInput(input);

//       // Verify result properties
//       assertExists(result);
//       assertExists(result.transaction);
//       assertExists(result.rpc);

//       // The transaction should be replaced with a fee bump transaction
//       assertEquals(result.transaction !== mockTransaction, true);

//       // But the RPC object should remain unchanged
//       assertEquals(result.rpc, mockRpc);
//     });
//   });

//   describe("Error Handling", () => {
//     it("should throw NOT_A_TRANSACTION for invalid input", async () => {
//       const plugin = PLG_FeeBump.create({
//         networkConfig,
//         feeBumpConfig: {
//           source: feeBumpSource.address(),
//           fee: "10000000",
//           signers: [feeBumpSource.signer()],
//         },
//       });

//       const mockRpc = {} as unknown as Server;
//       const mockTx = {} as unknown as Transaction;

//       await assertRejects(
//         async () =>
//           await plugin.processInput({
//             transaction: mockTx,
//             rpc: mockRpc,
//           } as unknown as PluginInput),
//         E.NOT_A_TRANSACTION
//       );

//       await assertRejects(
//         async () =>
//           await plugin.processInput({
//             transaction: "not a transaction" as any,
//             rpc: mockRpc,
//           }),
//         E.NOT_A_TRANSACTION
//       );
//     });

//     it("should throw MISSING_ARG when required arguments are missing", async () => {
//       await assertRejects(
//         async () =>
//           await PLG_FeeBump.create({
//             networkConfig,
//             // Missing entire feeBumpConfig
//           } as any),
//         E.MISSING_ARG
//       );

//       await assertRejects(
//         async () =>
//           await PLG_FeeBump.create({
//             // Missing networkConfig
//             feeBumpConfig: {
//               source: feeBumpSource.address(),
//               fee: "10000000",
//               signers: [feeBumpSource.signer()],
//             },
//           } as any),
//         E.MISSING_ARG
//       );
//     });

//     it("pipeline creation should throw UNEXPECTED_ERROR when an error is not handled", async () => {
//       await assertRejects(
//         async () =>
//           await PLG_FeeBump.create({
//             networkConfig: null as unknown as NetworkConfig,
//             feeBumpConfig: {
//               source: feeBumpSource.address(),
//               fee: "10000000",
//               signers: [feeBumpSource.signer()],
//             } as any,
//           }),

//         E.UNEXPECTED_ERROR
//       );
//     });
//   });
// });
