import {
  assert,
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { Buffer } from "node:buffer";
import type { Asset, Keypair, xdr } from "stellar-sdk";
import { Contract } from "./index.ts";
import {
  NetworkConfig,
  NetworkType,
  TestNet,
  TestNetConfig,
} from "../network/index.ts";
import { Server } from "stellar-sdk/rpc";
import * as E from "./error.ts";
import { ContractConfig } from "./types.ts";
import { NativeAccount } from "../account/native/index.ts";
import { LocalSigner } from "../signer/local/index.ts";
import { initializeWithFriendbot } from "../tools/friendbot/initialize-with-friendbot.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
describe("[Testnet] Contract", disableSanitizeConfig, () => {
  const networkConfig = TestNet();

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

  beforeAll(async () => {
    await initializeWithFriendbot(networkConfig.friendbotUrl, admin.address());
  });

  describe("Initialization", () => {
    let wasm: Buffer;
    beforeAll(async () => {
      wasm = await loadWasmFile(
        "./_internal/tests/compiled-contracts/types_harness.wasm"
      );
    });
    it("Initialized with WASM and upload binaries", async () => {
      const contract = new Contract({
        networkConfig,
        contractConfig: {
          wasm: wasm,
        },
      });

      assert;
      await contract.uploadWasm({
        fee: "10000000", // 1 XLM
        timeout: 30,
        source: admin.address(),
        signers: [admin.signer()],
      });
      assertExists(contract);
      assertInstanceOf(contract, Contract);
      assertExists(contract.getWasmHash());
    });
  });
});
