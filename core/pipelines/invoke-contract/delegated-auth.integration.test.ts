import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Contract,
  DelegatedSigner,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  StellarAssetContract,
  type TransactionConfig,
} from "@/mod.ts";
import { SimulateTransactionError } from "@/processes/simulate-transaction/error.ts";
import { StellarTestLedger } from "@colibri/test-tooling";
import { rpc } from "stellar-sdk";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import { RECURSIVE_DELEGATE_ACCOUNT_SPEC } from "colibri-internal/tests/specs/recursive-delegate-account.ts";
import { DELEGATED_ASSET_ACCOUNT_SPEC } from "colibri-internal/tests/specs/delegated-asset-account.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";

type Topology = {
  contract: Contract;
  signer: DelegatedSigner;
};

describe(
  "delegated invoke-contract authorization",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: "colibri-delegated-auth-integration",
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const admin = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const recipient = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const leaves = [
      LocalSigner.generateRandom(),
      LocalSigner.generateRandom(),
      LocalSigner.generateRandom(),
    ];

    let network: ReturnType<typeof NetworkConfig.CustomNet>;
    let countedRpc: rpc.Server;
    let simulationCalls = 0;
    let config: TransactionConfig;
    let nativeSac: StellarAssetContract;
    let recursiveWasmHash: string;
    let assetWasmHash: string;
    let direct: Topology;
    const successTopologies: Array<{ name: string; topology: Topology }> = [];

    const leafNode = (index: number) =>
      new DelegatedSigner({
        address: leaves[index].publicKey(),
        signer: leaves[index],
      });

    const contractNode = (
      address: string,
      nestedDelegates: DelegatedSigner[],
    ) =>
      new DelegatedSigner({
        address: address as ContractId,
        nestedDelegates,
      });

    const deployRecursive = async (
      nestedDelegates: string[],
    ): Promise<Contract> => {
      const contract = new Contract({
        networkConfig: network,
        rpc: countedRpc,
        contractConfig: {
          wasmHash: recursiveWasmHash,
          spec: RECURSIVE_DELEGATE_ACCOUNT_SPEC,
        },
      });
      await contract.deploy({
        config,
        constructorArgs: { nested_delegates: nestedDelegates },
      });
      return contract;
    };

    const deployTop = async (
      nestedDelegates: string[],
    ): Promise<Contract> => {
      const contract = new Contract({
        networkConfig: network,
        rpc: countedRpc,
        contractConfig: {
          wasmHash: assetWasmHash,
          spec: DELEGATED_ASSET_ACCOUNT_SPEC,
        },
      });
      await contract.deploy({
        config,
        constructorArgs: { nested_delegates: nestedDelegates },
      });
      return contract;
    };

    const topology = (
      contract: Contract,
      nestedDelegates: DelegatedSigner[],
    ): Topology => ({
      contract,
      signer: contractNode(contract.getContractId(), nestedDelegates),
    });

    const withdraw = async (
      target: Topology,
      signer = target.signer,
      amount = 1_0000000n,
    ) =>
      await target.contract.invoke({
        method: "withdraw",
        methodArgs: {
          token: nativeSac.contractId,
          to: recipient.address(),
          amount,
        },
        config: {
          ...config,
          signers: [admin.signer(), signer],
        },
      });

    beforeAll(async () => {
      await ledger.start();
      const details = await ledger.getNetworkDetails();
      network = NetworkConfig.CustomNet(details);
      const baseRpc = new rpc.Server(details.rpcUrl, { allowHttp: true });
      const latestLedger = await baseRpc.getLatestLedger();
      assert(parseInt(latestLedger.protocolVersion) >= 27);

      countedRpc = new Proxy(baseRpc, {
        get(target, property, receiver) {
          if (property === "simulateTransaction") {
            return async (
              ...args: Parameters<rpc.Server["simulateTransaction"]>
            ) => {
              simulationCalls++;
              return await target.simulateTransaction(...args);
            };
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });

      for (
        const address of [
          admin.address(),
          recipient.address(),
          ...leaves.map((leaf) => leaf.publicKey()),
        ]
      ) {
        await initializeWithFriendbot(
          details.friendbotUrl,
          address as Ed25519PublicKey,
          {
            rpcUrl: details.rpcUrl,
            allowHttp: true,
          },
        );
      }

      config = {
        fee: "10000000",
        timeout: 30,
        source: admin.address(),
        signers: [admin.signer()],
      };
      nativeSac = await StellarAssetContract.deploy({
        code: "XLM",
        issuer: "native",
        networkConfig: network,
        rpc: countedRpc,
        config,
      });

      const recursiveTemplate = new Contract({
        networkConfig: network,
        rpc: countedRpc,
        contractConfig: {
          wasm: await loadWasmFile(
            "./_internal/tests/compiled-contracts/recursive_delegate_account_contract.wasm",
          ),
          spec: RECURSIVE_DELEGATE_ACCOUNT_SPEC,
        },
      });
      await recursiveTemplate.uploadWasm(config);
      recursiveWasmHash = recursiveTemplate.getWasmHash();

      const assetTemplate = new Contract({
        networkConfig: network,
        rpc: countedRpc,
        contractConfig: {
          wasm: await loadWasmFile(
            "./_internal/tests/compiled-contracts/delegated_asset_account_contract.wasm",
          ),
          spec: DELEGATED_ASSET_ACCOUNT_SPEC,
        },
      });
      await assetTemplate.uploadWasm(config);
      assetWasmHash = assetTemplate.getWasmHash();

      const directContract = await deployTop([leaves[0].publicKey()]);
      direct = topology(directContract, [leafNode(0)]);
      successTopologies.push({ name: "one direct delegate", topology: direct });

      const oneNode = await deployRecursive([leaves[0].publicKey()]);
      const oneNodeTop = await deployTop([oneNode.getContractId()]);
      successTopologies.push({
        name: "one recursive contract node",
        topology: topology(oneNodeTop, [
          contractNode(oneNode.getContractId(), [leafNode(0)]),
        ]),
      });

      const deepLeaf = await deployRecursive([leaves[0].publicKey()]);
      const deepRoot = await deployRecursive([deepLeaf.getContractId()]);
      const deepTop = await deployTop([deepRoot.getContractId()]);
      successTopologies.push({
        name: "a deep delegate chain",
        topology: topology(deepTop, [
          contractNode(deepRoot.getContractId(), [
            contractNode(deepLeaf.getContractId(), [leafNode(0)]),
          ]),
        ]),
      });

      const siblingNode = await deployRecursive([
        leaves[0].publicKey(),
        leaves[1].publicKey(),
      ]);
      const siblingTop = await deployTop([siblingNode.getContractId()]);
      successTopologies.push({
        name: "sibling delegates below one recursive node",
        topology: topology(siblingTop, [
          contractNode(siblingNode.getContractId(), [
            leafNode(0),
            leafNode(1),
          ]),
        ]),
      });

      const branchA = await deployRecursive([leaves[0].publicKey()]);
      const branchB = await deployRecursive([leaves[1].publicKey()]);
      const branchTop = await deployTop([
        branchA.getContractId(),
        branchB.getContractId(),
      ]);
      successTopologies.push({
        name: "a branching contract hierarchy",
        topology: topology(branchTop, [
          contractNode(branchA.getContractId(), [leafNode(0)]),
          contractNode(branchB.getContractId(), [leafNode(1)]),
        ]),
      });

      const multipleTop = await deployTop([
        leaves[0].publicKey(),
        leaves[1].publicKey(),
      ]);
      successTopologies.push({
        name: "multiple top-level delegates",
        topology: topology(multipleTop, [leafNode(0), leafNode(1)]),
      });

      for (const { topology: target } of successTopologies) {
        simulationCalls = 0;
        await nativeSac.transfer({
          from: admin.address(),
          to: target.contract.getContractId(),
          amount: 10_0000000n,
          config,
        });
        assertEquals(simulationCalls, 1);
      }
    });

    afterAll(async () => {
      await ledger.stop();
      await ledger.destroy();
    });

    it("withdraws through each supported recursive topology", async () => {
      for (const { name, topology: target } of successTopologies) {
        const before = await nativeSac.balance({
          id: target.contract.getContractId(),
        });
        simulationCalls = 0;

        const result = await withdraw(target);
        const withdrawSimulationCalls = simulationCalls;
        const after = await nativeSac.balance({
          id: target.contract.getContractId(),
        });

        assert(result.hash, `${name} should submit successfully`);
        assertEquals(
          after,
          before - 1_0000000n,
          name,
        );
        assertEquals(
          withdrawSimulationCalls,
          2,
          `${name} should record and enforce authorization`,
        );
      }
    });

    it("rejects a missing delegated signature during enforcing simulation", async () => {
      const unsignedLeaf = new DelegatedSigner({
        address: leaves[0].publicKey(),
      });
      simulationCalls = 0;

      await assertRejects(
        () =>
          withdraw(
            direct,
            topology(direct.contract, [unsignedLeaf]).signer,
          ),
        SimulateTransactionError,
      );
      assertEquals(simulationCalls, 2);
    });

    it("rejects an unexpected delegate during enforcing simulation", async () => {
      simulationCalls = 0;

      await assertRejects(
        () =>
          withdraw(
            direct,
            topology(direct.contract, [leafNode(1)]).signer,
          ),
        SimulateTransactionError,
      );
      assertEquals(simulationCalls, 2);
    });

    it("rejects a signature from the wrong key during enforcing simulation", async () => {
      const wrongSignature = new DelegatedSigner({
        address: leaves[0].publicKey(),
        signer: leaves[2],
      });
      simulationCalls = 0;

      await assertRejects(
        () =>
          withdraw(
            direct,
            topology(direct.contract, [wrongSignature]).signer,
          ),
        SimulateTransactionError,
      );
      assertEquals(simulationCalls, 2);
    });
  },
);
