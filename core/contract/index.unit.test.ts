import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Contract } from "@/contract/index.ts";
import * as E from "@/contract/error.ts";
import type { Server } from "stellar-sdk/rpc";
import type { ContractConfig } from "@/contract/types.ts";
import { NetworkConfig } from "@/network/index.ts";
import { NetworkType } from "@/network/types.ts";
import { Operation } from "stellar-sdk";
import type { Spec } from "stellar-sdk/contract";
import type { ContractId } from "@/strkeys/types.ts";
import {
  CONTRACT_ERROR_MATCHER_PLUGIN_ID,
  createContractErrorMatcherPlugin,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import {
  ErrorByCode,
  ERRORS_CONTRACT_SPEC,
} from "colibri-internal/tests/specs/errors-contract.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";

class TestContract extends Contract {
  public requireNoContractIdForTest(): void {
    this.requireNoContractId();
  }
}

const hasContractErrorMatcherPlugin = (
  plugins: readonly unknown[],
): boolean =>
  (plugins as readonly { id: string }[]).some((plugin) =>
    plugin.id === CONTRACT_ERROR_MATCHER_PLUGIN_ID
  );

describe("Contract", () => {
  describe("construction", () => {
    it("instantiates a contract without rpc", () => {
      const mockWasm = Buffer.from("mock");
      const contract = new Contract({
        networkConfig: NetworkConfig.CustomNet({
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
          rpcUrl: "https://rpc.testnet.stellar.org",
        }),
        contractConfig: {
          wasm: mockWasm,
        },
      });
      assertExists(contract);
    });

    it("instantiates a contract with an rpc", () => {
      const mockWasm = Buffer.from("mock");
      const mockRpc = {} as unknown as Server;
      const contract = new Contract({
        networkConfig: NetworkConfig.CustomNet({
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
        }),
        contractConfig: {
          wasm: mockWasm,
        },
        rpc: mockRpc,
      });
      assertExists(contract);

      assertEquals(contract.getWasm(), mockWasm);
    });

    it("accepts structural binary wasm inputs without requiring Colibri's Buffer type", () => {
      const mockRpc = {} as unknown as Server;
      const networkConfig = NetworkConfig.CustomNet({
        type: NetworkType.TESTNET,
        networkPassphrase: "Test Network",
      });
      const uint8Contract = new Contract({
        networkConfig,
        contractConfig: {
          wasm: new Uint8Array([1, 2, 3]),
        },
        rpc: mockRpc,
      });
      const arrayBuffer = new Uint8Array([4, 5, 6]).buffer;
      const arrayBufferContract = new Contract({
        networkConfig,
        contractConfig: {
          wasm: arrayBuffer,
        },
        rpc: mockRpc,
      });
      const source = new Uint8Array([0, 7, 8, 9, 0]);
      const dataViewContract = new Contract({
        networkConfig,
        contractConfig: {
          wasm: new DataView(source.buffer, 1, 3),
        },
        rpc: mockRpc,
      });

      assertEquals([...uint8Contract.getWasm()], [1, 2, 3]);
      assertEquals([...arrayBufferContract.getWasm()], [4, 5, 6]);
      assertEquals([...dataViewContract.getWasm()], [7, 8, 9]);
    });

    it("adds configured constructor plugins to the selected owned pipelines", () => {
      const mockRpc = {} as unknown as Server;
      const invokePlugin = createContractErrorMatcherPlugin({
        265: { message: "Known invoke error" },
      });
      const readPlugin = createContractErrorMatcherPlugin({
        3477: { message: "Known read error" },
      });
      const contract = new Contract({
        networkConfig: NetworkConfig.CustomNet({
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
        }),
        contractConfig: {
          wasmHash: "mockHash",
          plugins: {
            invokePipe: [invokePlugin],
            readPipe: [readPlugin],
          },
        },
        rpc: mockRpc,
      });

      assertEquals(
        (contract.invokePipe.plugins as readonly unknown[]).includes(
          invokePlugin,
        ),
        true,
      );
      assertEquals(
        (contract.readPipe.plugins as readonly unknown[]).includes(readPlugin),
        true,
      );
    });
  });

  describe("construction Errors", () => {
    it("throws MISSING_ARG when missing required args", () => {
      const mockWasm = Buffer.from("mock");
      const contractConfig = {
        wasm: mockWasm,
      };
      assertThrows(
        () =>
          new Contract({
            networkConfig: undefined as unknown as NetworkConfig,
            contractConfig,
          }),
        E.MISSING_ARG,
      );

      assertThrows(
        () =>
          new Contract({
            networkConfig: {} as unknown as NetworkConfig,
            contractConfig,
          }),
        E.MISSING_ARG,
      );

      assertThrows(
        () =>
          new Contract({
            networkConfig: {
              type: NetworkType.TESTNET,
              networkPassphrase: "Test Network",
            } as unknown as NetworkConfig,
            contractConfig: undefined as unknown as ContractConfig,
          }),
        E.MISSING_ARG,
      );
    });

    it("throws MISSING_RPC_URL when missing rpc and rpcUrl", () => {
      const mockWasm = Buffer.from("mock");
      assertThrows(
        () =>
          new Contract({
            networkConfig: NetworkConfig.CustomNet({
              type: NetworkType.TESTNET,
              networkPassphrase: "Test Network",
            }),
            contractConfig: {
              wasm: mockWasm,
            },
          }),
        E.MISSING_RPC_URL,
      );
    });

    it("throws INVALID_CONTRACT_CONFIG if contractConfig doesn't match the required shape", () => {
      assertThrows(
        () =>
          new Contract({
            networkConfig: NetworkConfig.CustomNet({
              type: NetworkType.TESTNET,
              networkPassphrase: "Test Network",
              rpcUrl: "https://rpc.testnet.stellar.org",
            }),
            contractConfig: {} as unknown as ContractConfig,
          }),
        E.INVALID_CONTRACT_CONFIG,
      );
    });

    it("throws MISSING_REQUIRED_PROPERTY if contract is missing required properties", () => {
      const mockWasm = Buffer.from("mock");
      const mockRpc = {} as unknown as Server;
      const contractWithWasm = new Contract({
        networkConfig: NetworkConfig.CustomNet({
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
        }),
        contractConfig: {
          wasm: mockWasm,
        },
        rpc: mockRpc,
      });

      const contractWithWasmHash = new Contract({
        networkConfig: NetworkConfig.CustomNet({
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
        }),
        contractConfig: {
          wasmHash: "mockHash",
        },
        rpc: mockRpc,
      });

      assertThrows(
        () => contractWithWasm.getWasmHash(),
        E.MISSING_REQUIRED_PROPERTY,
      );

      assertThrows(
        () => contractWithWasm.getSpec(),
        E.MISSING_REQUIRED_PROPERTY,
      );

      assertThrows(
        () => contractWithWasm.getContractId(),
        E.MISSING_REQUIRED_PROPERTY,
      );

      assertThrows(
        () => contractWithWasmHash.getWasm(),
        E.MISSING_REQUIRED_PROPERTY,
      );
    });
  });

  describe("helpers and execution paths", () => {
    const networkConfig = NetworkConfig.CustomNet({
      type: NetworkType.TESTNET,
      networkPassphrase: "Test Network",
    });
    const mockRpc = {} as unknown as Server;

    it("executes the protected requireNoContractId helper", () => {
      const contract = new TestContract({
        networkConfig,
        contractConfig: {
          wasm: Buffer.from("mock"),
        },
        rpc: mockRpc,
      });

      contract.requireNoContractIdForTest();

      const contractWithId = new TestContract({
        networkConfig,
        contractConfig: {
          contractId:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
        },
        rpc: mockRpc,
      });

      assertThrows(
        () => contractWithId.requireNoContractIdForTest(),
        E.PROPERTY_ALREADY_SET,
      );
    });

    it("loads contract errors from an existing spec and installs the matcher on both owned pipelines", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: "mockHash",
          spec: ERRORS_CONTRACT_SPEC,
        },
        rpc: mockRpc,
      });

      const errors = await contract.loadContractErrorsFromWasm({
        strategy: "any",
      });

      assertEquals(errors, ErrorByCode);
      assertEquals(
        hasContractErrorMatcherPlugin(contract.invokePipe.plugins),
        true,
      );
      assertEquals(
        hasContractErrorMatcherPlugin(contract.readPipe.plugins),
        true,
      );
    });

    it("loads contract errors from local wasm when no spec is already loaded", async () => {
      const wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/errors_contract.wasm",
      );
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasm,
        },
        rpc: mockRpc,
      });

      const errors = await contract.loadContractErrorsFromWasm({
        strategy: "any",
      });

      assertEquals(errors, ErrorByCode);
      assertEquals(
        hasContractErrorMatcherPlugin(contract.invokePipe.plugins),
        true,
      );
      assertEquals(
        hasContractErrorMatcherPlugin(contract.readPipe.plugins),
        true,
      );
    });

    it("uses the bound contract id for contract-id error loading", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          contractId:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
          spec: ERRORS_CONTRACT_SPEC,
        },
        rpc: mockRpc,
      });

      const errors = await contract.loadContractErrorsFromWasm({
        strategy: "contract-id",
      });

      assertEquals(errors, ErrorByCode);
      assertEquals(
        hasContractErrorMatcherPlugin(contract.invokePipe.plugins),
        true,
      );
      assertEquals(
        hasContractErrorMatcherPlugin(contract.readPipe.plugins),
        true,
      );
    });

    it("uses an explicit contract id for contract-id error loading", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: "mockHash",
          spec: ERRORS_CONTRACT_SPEC,
        },
        rpc: mockRpc,
      });

      const errors = await contract.loadContractErrorsFromWasm({
        strategy: "contract-id",
        contractId:
          "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
      });

      assertEquals(errors, ErrorByCode);
      assertEquals(
        hasContractErrorMatcherPlugin(contract.invokePipe.plugins),
        true,
      );
      assertEquals(
        hasContractErrorMatcherPlugin(contract.readPipe.plugins),
        true,
      );
    });

    it("loads contract errors for issued-from matching", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: "mockHash",
          spec: ERRORS_CONTRACT_SPEC,
        },
        rpc: mockRpc,
      });

      const errors = await contract.loadContractErrorsFromWasm({
        strategy: "issued-from",
        issuedFrom: "sub-invocation",
      });

      assertEquals(errors, ErrorByCode);
      assertEquals(
        hasContractErrorMatcherPlugin(contract.invokePipe.plugins),
        true,
      );
      assertEquals(
        hasContractErrorMatcherPlugin(contract.readPipe.plugins),
        true,
      );
    });

    it("does not install the matcher when the loaded spec has no contract errors", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: "mockHash",
          spec: { errorCases: () => [] } as unknown as Spec,
        },
        rpc: mockRpc,
      });

      const errors = await contract.loadContractErrorsFromWasm({
        strategy: "any",
      });

      assertEquals(errors, {});
      assertEquals(
        hasContractErrorMatcherPlugin(contract.invokePipe.plugins),
        false,
      );
      assertEquals(
        hasContractErrorMatcherPlugin(contract.readPipe.plugins),
        false,
      );
    });

    it("throws when loading contract errors would add a second matcher to the invoke pipeline", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: "mockHash",
          spec: ERRORS_CONTRACT_SPEC,
          plugins: {
            invokePipe: [createContractErrorMatcherPlugin(ErrorByCode)],
          },
        },
        rpc: mockRpc,
      });

      await assertRejects(
        async () =>
          await contract.loadContractErrorsFromWasm({
            strategy: "any",
          }),
        E.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED,
      );
    });

    it("throws when loading contract errors would add a second matcher to the read pipeline", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasmHash: "mockHash",
          spec: ERRORS_CONTRACT_SPEC,
          plugins: {
            readPipe: [createContractErrorMatcherPlugin(ErrorByCode)],
          },
        },
        rpc: mockRpc,
      });

      await assertRejects(
        async () =>
          await contract.loadContractErrorsFromWasm({
            strategy: "any",
          }),
        E.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED,
      );
    });

    it("reads from a contract without method arguments", async () => {
      let encodedArgsCallCount = 0;
      const readResult = { ok: true };
      const spec = {
        funcArgsToScVals: () => {
          encodedArgsCallCount++;
          return [];
        },
        funcResToNative: (_method: string, result: unknown) => result,
      } as unknown as Spec;
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          contractId:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
          spec,
        },
        rpc: mockRpc,
      });

      let runInput:
        | { operations: ReturnType<typeof Operation.invokeContractFunction>[] }
        | undefined;
      Object.defineProperty(contract, "readPipe", {
        value: {
          run: (input: typeof runInput) => {
            runInput = input ?? undefined;
            return readResult;
          },
        },
        configurable: true,
      });

      const result = await contract.read({
        method: "hello",
      });

      assertEquals(result, readResult);
      assertEquals(encodedArgsCallCount, 0);
      assertExists(runInput);
      assertEquals(runInput.operations.length, 1);

      const expectedOperation = Operation.invokeContractFunction({
        function: "hello",
        contract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        args: [],
      });
      assertEquals(
        runInput.operations[0].toXDR("base64"),
        expectedOperation.toXDR("base64"),
      );
    });
  });
});
