import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { stub } from "@std/testing/mock";
import { Buffer } from "node:buffer";
import { Contract } from "@/contract/index.ts";
import * as ERROR from "@/contract/error.ts";
import type { Server } from "stellar-sdk/rpc";
import type { ContractConfig } from "@/contract/types.ts";
import { NetworkConfig } from "@/network/index.ts";
import { NetworkType } from "@/network/types.ts";
import { Address, Operation, xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import type { Api } from "stellar-sdk/rpc";
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
import {
  buildContractCodeLedgerKey,
  buildContractDataLedgerKey,
  buildContractInstanceLedgerKey,
} from "@/ledger-entries/index.ts";

const { describe, it, observer: suiteObserver } = recordColibriTests(
  import.meta.url,
);

class TestContract extends Contract {
  public requireNoContractIdForTest(): void {
    this.requireNoContractId();
  }

  public requireNoSpecForTest(): void {
    this.requireNoSpec();
  }
}

const hasContractErrorMatcherPlugin = (
  plugins: readonly unknown[],
): boolean =>
  (plugins as readonly { id: string }[]).some((plugin) =>
    plugin.id === CONTRACT_ERROR_MATCHER_PLUGIN_ID
  );

const NETWORK_CONTRACT_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId;

const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  xdr.encodeBytes(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)),
    ),
    "hex",
  );

const rpcWithLedgerEntries = (
  entries: readonly Api.LedgerEntryResult[],
): Server => {
  const byKey = new Map(
    entries.map((entry) => [entry.key.toXdr("base64"), entry]),
  );
  return {
    getLedgerEntries: (...keys: xdr.LedgerKey[]) =>
      Promise.resolve({
        entries: keys.flatMap((key) => {
          const entry = byKey.get(key.toXdr("base64"));
          return entry ? [entry] : [];
        }),
        latestLedger: 100,
      }),
  } as unknown as Server;
};

const contractCodeEntry = (
  hash: string,
  wasm: Uint8Array,
): Api.LedgerEntryResult => ({
  key: buildContractCodeLedgerKey({ hash }),
  val: xdr.LedgerEntryData.contractCode(
    new xdr.ContractCodeEntry({
      ext: xdr.ContractCodeEntryExt.v0(),
      hash: xdr.decodeBytes(hash, "hex"),
      code: wasm,
    }),
  ),
});

const contractInstanceEntry = (
  executable: xdr.ContractExecutable,
): Api.LedgerEntryResult => ({
  key: buildContractInstanceLedgerKey({ contractId: NETWORK_CONTRACT_ID }),
  val: xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: xdr.ExtensionPoint.v0(),
      contract: Address.fromString(NETWORK_CONTRACT_ID).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
      val: xdr.ScVal.scvContractInstance(
        new xdr.ScContractInstance({ executable, storage: [] }),
      ),
    }),
  ),
});

const externalReferenceEntry = (
  tag: Uint8Array,
  hash: string,
): Api.LedgerEntryResult => {
  const key = xdr.ScVal.scvExecutableTag(new xdr.XdrString(tag));
  return {
    key: buildContractDataLedgerKey({
      contractId: NETWORK_CONTRACT_ID,
      key,
    }),
    val: xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        ext: xdr.ExtensionPoint.v0(),
        contract: Address.fromString(NETWORK_CONTRACT_ID).toScAddress(),
        key,
        durability: xdr.ContractDataDurability.persistent,
        val: xdr.ScVal.scvBytes(xdr.decodeBytes(hash, "hex")),
      }),
    ),
  };
};

describe("Contract", () => {
  describe("construction", () => {
    it("instantiates a contract without rpc", () => {
      const mockWasm = Buffer.from("mock");
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig: NetworkConfig.CustomNet({
            type: NetworkType.TESTNET,
            networkPassphrase: "Test Network",
            rpcUrl: "https://rpc.testnet.stellar.org",
          }),
          contractConfig: {
            wasm: mockWasm,
          },
        }),
        { name: "contract" },
      );
      assertExists(contract);
    });

    it("instantiates a contract with an rpc", () => {
      const mockWasm = Buffer.from("mock");
      const mockRpc = {} as unknown as Server;
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig: NetworkConfig.CustomNet({
            type: NetworkType.TESTNET,
            networkPassphrase: "Test Network",
          }),
          contractConfig: {
            wasm: mockWasm,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );
      assertExists(contract);

      assertEquals(contract.getWasm(), Uint8Array.from(mockWasm));
    });

    it("accepts structural binary wasm inputs without requiring Colibri's Buffer type", () => {
      const mockRpc = {} as unknown as Server;
      const networkConfig = NetworkConfig.CustomNet({
        type: NetworkType.TESTNET,
        networkPassphrase: "Test Network",
      });
      const uint8Contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasm: new Uint8Array([1, 2, 3]),
          },
          rpc: mockRpc,
        }),
        { name: "uint8Contract" },
      );
      const arrayBuffer = new Uint8Array([4, 5, 6]).buffer;
      const arrayBufferContract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasm: arrayBuffer,
          },
          rpc: mockRpc,
        }),
        { name: "arrayBufferContract" },
      );
      const source = new Uint8Array([0, 7, 8, 9, 0]);
      const dataViewContract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasm: new DataView(source.buffer, 1, 3),
          },
          rpc: mockRpc,
        }),
        { name: "dataViewContract" },
      );

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
      const contract = suiteObserver.attach(
        new Contract({
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
        }),
        { name: "contract" },
      );

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

    it("accepts a CAP-85 external executable reference", () => {
      const externalRef = {
        owner: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        tag: new Uint8Array([0x72, 0x65, 0x6c, 0xff]),
      } as const;
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig: NetworkConfig.CustomNet({
            type: NetworkType.TESTNET,
            networkPassphrase: "Test Network",
          }),
          contractConfig: { externalRef },
          rpc: {} as Server,
        }),
        { name: "contract" },
      );

      assertEquals(contract.getExternalRef(), externalRef);
      assertThrows(
        () => contract.getWasmHash(),
        ERROR.MISSING_REQUIRED_PROPERTY,
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
          suiteObserver.attach(
            new Contract({
              networkConfig: undefined as unknown as NetworkConfig,
              contractConfig,
            }),
            { name: "Contract" },
          ),
        ERROR.MISSING_ARG,
      );

      assertThrows(
        () =>
          suiteObserver.attach(
            new Contract({
              networkConfig: {} as unknown as NetworkConfig,
              contractConfig,
            }),
            { name: "Contract" },
          ),
        ERROR.MISSING_ARG,
      );

      assertThrows(
        () =>
          suiteObserver.attach(
            new Contract({
              networkConfig: {
                type: NetworkType.TESTNET,
                networkPassphrase: "Test Network",
              } as unknown as NetworkConfig,
              contractConfig: undefined as unknown as ContractConfig,
            }),
            { name: "Contract" },
          ),
        ERROR.MISSING_ARG,
      );
    });

    it("throws MISSING_RPC_URL when missing rpc and rpcUrl", () => {
      const mockWasm = Buffer.from("mock");
      assertThrows(
        () =>
          suiteObserver.attach(
            new Contract({
              networkConfig: NetworkConfig.CustomNet({
                type: NetworkType.TESTNET,
                networkPassphrase: "Test Network",
              }),
              contractConfig: {
                wasm: mockWasm,
              },
            }),
            { name: "Contract" },
          ),
        ERROR.MISSING_RPC_URL,
      );
    });

    it("throws INVALID_CONTRACT_CONFIG if contractConfig doesn't match the required shape", () => {
      assertThrows(
        () =>
          suiteObserver.attach(
            new Contract({
              networkConfig: NetworkConfig.CustomNet({
                type: NetworkType.TESTNET,
                networkPassphrase: "Test Network",
                rpcUrl: "https://rpc.testnet.stellar.org",
              }),
              contractConfig: {} as unknown as ContractConfig,
            }),
            { name: "Contract" },
          ),
        ERROR.INVALID_CONTRACT_CONFIG,
      );
    });

    it("throws a unique error when mutually exclusive sources are combined", () => {
      assertThrows(
        () =>
          suiteObserver.attach(
            new Contract({
              networkConfig: NetworkConfig.CustomNet({
                type: NetworkType.TESTNET,
                networkPassphrase: "Test Network",
              }),
              contractConfig: {
                wasmHash: "ab".repeat(32),
                externalRef: {
                  owner:
                    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
                  tag: "release",
                },
              } as unknown as ContractConfig,
              rpc: {} as Server,
            }),
            { name: "Contract" },
          ),
        ERROR.CONTRACT_CONFIG_SOURCES_CONFLICT,
      );
    });

    it("throws MISSING_REQUIRED_PROPERTY if contract is missing required properties", () => {
      const mockWasm = Buffer.from("mock");
      const mockRpc = {} as unknown as Server;
      const contractWithWasm = suiteObserver.attach(
        new Contract({
          networkConfig: NetworkConfig.CustomNet({
            type: NetworkType.TESTNET,
            networkPassphrase: "Test Network",
          }),
          contractConfig: {
            wasm: mockWasm,
          },
          rpc: mockRpc,
        }),
        { name: "contractWithWasm" },
      );

      const contractWithWasmHash = suiteObserver.attach(
        new Contract({
          networkConfig: NetworkConfig.CustomNet({
            type: NetworkType.TESTNET,
            networkPassphrase: "Test Network",
          }),
          contractConfig: {
            wasmHash: "mockHash",
          },
          rpc: mockRpc,
        }),
        { name: "contractWithWasmHash" },
      );

      assertThrows(
        () => contractWithWasm.getWasmHash(),
        ERROR.MISSING_REQUIRED_PROPERTY,
      );

      assertThrows(
        () => contractWithWasm.getSpec(),
        ERROR.MISSING_REQUIRED_PROPERTY,
      );

      assertThrows(
        () => contractWithWasm.getContractId(),
        ERROR.MISSING_REQUIRED_PROPERTY,
      );

      assertThrows(
        () => contractWithWasmHash.getWasm(),
        ERROR.MISSING_REQUIRED_PROPERTY,
      );
    });
  });

  describe("helpers and execution paths", () => {
    const networkConfig = NetworkConfig.CustomNet({
      type: NetworkType.TESTNET,
      networkPassphrase: "Test Network",
    });
    const mockRpc = {} as unknown as Server;

    it("executes the protected unset-property helpers", () => {
      const contract = suiteObserver.attach(
        new TestContract({
          networkConfig,
          contractConfig: {
            wasm: Buffer.from("mock"),
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

      contract.requireNoContractIdForTest();
      contract.requireNoSpecForTest();

      const contractWithId = suiteObserver.attach(
        new TestContract({
          networkConfig,
          contractConfig: {
            contractId:
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
          },
          rpc: mockRpc,
        }),
        { name: "contractWithId" },
      );

      assertThrows(
        () => contractWithId.requireNoContractIdForTest(),
        ERROR.PROPERTY_ALREADY_SET,
      );

      const contractWithSpec = suiteObserver.attach(
        new TestContract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: ERRORS_CONTRACT_SPEC,
          },
          rpc: mockRpc,
        }),
        { name: "contractWithSpec" },
      );
      assertThrows(
        () => contractWithSpec.requireNoSpecForTest(),
        ERROR.PROPERTY_ALREADY_SET,
      );
    });

    it("builds external-reference deployments through the existing invoke pipeline", async () => {
      const externalRef = {
        owner: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
        tag: new Uint8Array([0x72, 0x65, 0x6c, 0xff]),
      } as const;
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { externalRef },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );
      const salt = new Uint8Array(32).fill(7);
      let operation:
        | ReturnType<typeof Operation.createCustomContract>
        | undefined;
      Object.defineProperty(contract, "invokePipe", {
        configurable: true,
        value: {
          run: (input: {
            operations: ReturnType<typeof Operation.createCustomContract>[];
          }) => {
            operation = input.operations[0];
            return Promise.reject(new Error("stop after operation assembly"));
          },
        },
      });

      await assertRejects(
        () =>
          contract.deploy({
            config: {
              source:
                "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
              fee: "100",
              timeout: 30,
              signers: [],
            },
            salt,
          }),
        ERROR.FAILED_TO_DEPLOY_CONTRACT,
      );

      assertExists(operation);
      assertEquals(
        operation.toXdr("base64"),
        Operation.createCustomContract({
          address: new Address(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          ),
          externalRef,
          salt,
        }).toXdr("base64"),
      );
    });

    it("loads event declarations from network WASM when the client has only its hash", async () => {
      const wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/bindings_demo_contract.wasm",
      );
      const hash = await sha256Hex(wasm);
      const client = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { wasmHash: hash },
          rpc: rpcWithLedgerEntries([contractCodeEntry(hash, wasm)]),
        }),
        { name: "client" },
      );
      await client.loadContractEventsFromWasm();
      assertEquals([...client.getWasm()], [...wasm]);
      assertEquals(client.events.get("CountChanged").name, "CountChanged");
    });

    it("loads current network specs from direct and external executables", async () => {
      const wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/errors_contract.wasm",
      );
      const hash = await sha256Hex(wasm);
      const tag = new Uint8Array([0x72, 0x65, 0x6c, 0xff]);
      const code = contractCodeEntry(hash, wasm);

      const byHash = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { wasmHash: hash },
          rpc: rpcWithLedgerEntries([code]),
        }),
        { name: "byHash" },
      );
      await byHash.loadSpecFromNetwork();
      assertEquals([...byHash.getWasm()], [...wasm]);
      assertExists(byHash.getSpec());
      const rawCode = await byHash.getContractCodeLedgerEntry();
      assertEquals(
        rawCode.key.toXdr("base64"),
        code.key.toXdr("base64"),
      );

      const byContract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { contractId: NETWORK_CONTRACT_ID },
          rpc: rpcWithLedgerEntries([
            contractInstanceEntry(
              xdr.ContractExecutable.contractExecutableWasm(
                xdr.decodeBytes(hash, "hex"),
              ),
            ),
            code,
          ]),
        }),
        { name: "byContract" },
      );
      await byContract.loadSpecFromNetwork();
      assertEquals(byContract.getWasmHash(), hash);

      const byExternalRef = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            externalRef: { owner: NETWORK_CONTRACT_ID, tag },
          },
          rpc: rpcWithLedgerEntries([
            externalReferenceEntry(tag, hash),
            code,
          ]),
        }),
        { name: "byExternalRef" },
      );
      await byExternalRef.loadSpecFromNetwork();
      assertEquals([...byExternalRef.getWasm()], [...wasm]);
      assertEquals(byExternalRef.getWasmHash(), hash);
    });

    it("keeps network executable lookup failures occurrence-specific", async () => {
      const localWasm = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { wasm: new Uint8Array([1]) },
          rpc: rpcWithLedgerEntries([]),
        }),
        { name: "localWasm" },
      );
      await assertRejects(
        () => localWasm.loadSpecFromNetwork(),
        ERROR.NETWORK_EXECUTABLE_NOT_AVAILABLE,
      );

      const missingCode = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { wasmHash: "ab".repeat(32) },
          rpc: rpcWithLedgerEntries([]),
        }),
        { name: "missingCode" },
      );
      await assertRejects(
        () => missingCode.loadSpecFromNetwork(),
        ERROR.CONTRACT_CODE_NOT_FOUND,
      );

      const stellarAsset = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: { contractId: NETWORK_CONTRACT_ID },
          rpc: rpcWithLedgerEntries([
            contractInstanceEntry(
              xdr.ContractExecutable.contractExecutableStellarAsset(),
            ),
          ]),
        }),
        { name: "stellarAsset" },
      );
      await assertRejects(
        () => stellarAsset.loadSpecFromNetwork(),
        ERROR.STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM,
      );
    });

    it("loads contract errors from an existing spec and installs the matcher on both owned pipelines", async () => {
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: ERRORS_CONTRACT_SPEC,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasm,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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

    it("loads contract errors from deployed wasm when no spec or local wasm is available", async () => {
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            contractId:
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );
      const loadSpecStub = stub(
        contract,
        "loadSpecFromNetwork",
        () => Promise.resolve(),
      );
      const getSpecStub = stub(contract, "getSpec", () => ERRORS_CONTRACT_SPEC);

      try {
        const errors = await contract.loadContractErrorsFromWasm({
          strategy: "any",
        });

        assertEquals(loadSpecStub.calls.length, 1);
        assertEquals(errors, ErrorByCode);
      } finally {
        loadSpecStub.restore();
        getSpecStub.restore();
      }
    });

    it("uses the bound contract id for contract-id error loading", async () => {
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            contractId:
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
            spec: ERRORS_CONTRACT_SPEC,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: ERRORS_CONTRACT_SPEC,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: ERRORS_CONTRACT_SPEC,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: new Spec(
              ERRORS_CONTRACT_SPEC.entries.filter((entry) =>
                entry.type !== "scSpecEntryUdtErrorEnumV0"
              ),
            ),
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: ERRORS_CONTRACT_SPEC,
            plugins: {
              invokePipe: [createContractErrorMatcherPlugin(ErrorByCode)],
            },
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

      await assertRejects(
        async () =>
          await contract.loadContractErrorsFromWasm({
            strategy: "any",
          }),
        ERROR.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED,
      );
    });

    it("throws when loading contract errors would add a second matcher to the read pipeline", async () => {
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            wasmHash: "mockHash",
            spec: ERRORS_CONTRACT_SPEC,
            plugins: {
              readPipe: [createContractErrorMatcherPlugin(ErrorByCode)],
            },
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

      await assertRejects(
        async () =>
          await contract.loadContractErrorsFromWasm({
            strategy: "any",
          }),
        ERROR.CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED,
      );
    });

    it("reads from a contract without method arguments", async () => {
      let encodedArgsCallCount = 0;
      const readResult = { ok: true };
      const spec = new Spec([
        xdr.ScSpecEntry.scSpecEntryFunctionV0(
          new xdr.ScSpecFunctionV0({
            name: "hello",
            doc: "",
            inputs: [],
            outputs: [],
          }),
        ),
      ]);
      using encode = stub(spec, "funcArgsToScVals", () => {
        encodedArgsCallCount++;
        return [];
      });
      using decode = stub(
        spec,
        "funcResToNative",
        (_method: string, result: unknown) => result,
      );
      void [encode, decode];
      const contract = suiteObserver.attach(
        new Contract({
          networkConfig,
          contractConfig: {
            contractId:
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" as ContractId,
            spec,
          },
          rpc: mockRpc,
        }),
        { name: "contract" },
      );

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
        runInput.operations[0].toXdr("base64"),
        expectedOperation.toXdr("base64"),
      );
    });
  });
});
