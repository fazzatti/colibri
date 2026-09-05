import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { Contract } from "@/contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { StellarTestLedger } from "@colibri/test-tooling";
import { EXECUTABLE_REF_MANAGER_SPEC } from "colibri-internal/tests/specs/executable-ref-manager.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";

describe(
  "[Quickstart] loaded contract provenance",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: "colibri-contract-snapshot",
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const signer = LocalSigner.generateRandom();
    const config: TransactionConfig = {
      source: signer.publicKey(),
      fee: "100000000",
      timeout: 60,
      signers: [signer],
    };
    let networkConfig: NetworkConfig;
    beforeAll(async () => {
      await ledger.start();
      const details = await ledger.getNetworkDetails();
      networkConfig = NetworkConfig.CustomNet(details);
      await initializeWithFriendbot(details.friendbotUrl, signer.publicKey(), {
        rpcUrl: details.rpcUrl,
        allowHttp: true,
      });
    });
    afterAll(async () => {
      await ledger.destroy();
    });

    it("publishes explicit refreshes atomically and preserves the previous load on a real RPC failure", async () => {
      const versions = await Promise.all([1, 2].map((version) =>
        Deno.readFile(
          `_internal/build-verification/fixtures/upgradeable-v${version}.wasm`,
        )
      ));
      const hashes: string[] = [];
      for (const wasm of versions) {
        const upload = new Contract({
          networkConfig,
          contractConfig: { wasm },
        });
        assertEquals(upload.getLoadedSnapshot(), undefined);
        await upload.uploadWasm(config);
        hashes.push(upload.getWasmHash());
      }
      const byHash = new Contract({
        networkConfig,
        contractConfig: { wasmHash: hashes[0] },
      });
      await byHash.loadSpecFromNetwork();
      const hashSnapshot = byHash.getLoadedSnapshot();
      assertExists(hashSnapshot);
      assertEquals(hashSnapshot.executable, {
        type: "wasm",
        wasmHash: hashes[0],
      });
      assertEquals(hashSnapshot.reference, undefined);
      assert(hashSnapshot.observedAtLedger > 0);

      const manager = new Contract({
        networkConfig,
        contractConfig: {
          wasm: await Deno.readFile(
            "_internal/tests/compiled-contracts/executable_ref_manager_contract.wasm",
          ),
          spec: EXECUTABLE_REF_MANAGER_SPEC,
        },
      });
      await manager.uploadWasm(config);
      await manager.deploy({ config });
      const setVersion = (version: number) =>
        manager.invoke({
          method: "set",
          methodArgs: {
            tag: "stable",
            wasm_hash: xdr.decodeBytes(hashes[version - 1], "hex"),
          },
          config,
        });
      await setVersion(1);
      const byReference = new Contract({
        networkConfig,
        contractConfig: {
          externalRef: { owner: manager.getContractId(), tag: "stable" },
        },
      });
      await byReference.loadSpecFromNetwork();
      const first = byReference.getLoadedSnapshot();
      assertExists(first?.reference);
      assertEquals(first.wasmHash, hashes[0]);
      assertEquals(byReference.getWasm(), versions[0]);
      await byReference.deploy({ config });
      const byId = new Contract({
        networkConfig,
        contractConfig: { contractId: byReference.getContractId() },
      });
      await byId.loadSpecFromNetwork();
      assertEquals(
        byId.getLoadedSnapshot()?.contractId,
        byReference.getContractId(),
      );
      assertExists(byId.getLoadedSnapshot()?.instance);
      assertExists(byId.getLoadedSnapshot()?.reference);

      await setVersion(2);
      assertEquals(byReference.getLoadedSnapshot(), first); // No implicit refresh.
      await byReference.getContractCodeLedgerEntry(); // A read does not publish new local state.
      assertEquals(byReference.getLoadedSnapshot(), first);
      assertEquals(byReference.getWasmHash(), hashes[0]);
      await byReference.loadSpecFromNetwork();
      const second = byReference.getLoadedSnapshot();
      assertExists(second);
      assertEquals(second.wasmHash, hashes[1]);
      assertEquals(byReference.getWasmHash(), hashes[1]);
      assertEquals(byReference.getWasm(), versions[1]);
      assert(second.observedAtLedger > first.observedAtLedger);
      assertEquals(await byReference.read({ method: "version" }), 2);
      const detached = byReference.getLoadedSnapshot()!;
      detached.wasmHash = "not-the-loaded-hash";
      if (detached.executable.type === "externalRef") {
        detached.executable.tag.fill(0);
      }
      assertEquals(byReference.getLoadedSnapshot(), second);

      const spec = byReference.getSpec();
      const wasm = byReference.getWasm();
      await ledger.stop();
      await assertRejects(() => byReference.loadSpecFromNetwork());
      assertEquals(byReference.getLoadedSnapshot(), second);
      assertEquals(byReference.getWasmHash(), hashes[1]);
      assertStrictEquals(byReference.getSpec(), spec);
      assertStrictEquals(byReference.getWasm(), wasm);
    });
  },
);
