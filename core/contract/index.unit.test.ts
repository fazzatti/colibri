import {
  assert,
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "node:buffer";
import type { Asset, Keypair, xdr } from "stellar-sdk";
import { Contract } from "./index.ts";
import { NetworkConfig, NetworkType } from "../network/index.ts";
import { Server } from "stellar-sdk/rpc";
import * as E from "./error.ts";
import { ContractConfig } from "./types.ts";
describe("Contract", () => {
  describe("construction", () => {
    it("instantiates a contract without rpc", () => {
      const mockWasm = Buffer.from("mock");
      const contract = new Contract({
        networkConfig: {
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
          rpcUrl: "https://rpc.testnet.stellar.org",
        },
        contractConfig: {
          wasm: mockWasm,
        },
      });
      assertExists(contract);
      assertInstanceOf(contract, Contract);
    });

    it("instantiates a contract with an rpc", () => {
      const mockWasm = Buffer.from("mock");
      const mockRpc = {} as unknown as Server;
      const contract = new Contract({
        networkConfig: {
          type: NetworkType.TESTNET,
          networkPassphrase: "Test Network",
        },
        contractConfig: {
          wasm: mockWasm,
        },
        rpc: mockRpc,
      });
      assertExists(contract);
      assertInstanceOf(contract, Contract);
      assertEquals(contract.getWasm(), mockWasm);
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
        E.MISSING_ARG
      );

      assertThrows(
        () =>
          new Contract({
            networkConfig: {} as unknown as NetworkConfig,
            contractConfig,
          }),
        E.MISSING_ARG
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
        E.MISSING_ARG
      );
    });

    it("throws MISSING_RPC_URL when missing rpc and rpcUrl", () => {
      const mockWasm = Buffer.from("mock");
      assertThrows(
        () =>
          new Contract({
            networkConfig: {
              type: NetworkType.TESTNET,
              networkPassphrase: "Test Network",
            },
            contractConfig: {
              wasm: mockWasm,
            },
          }),
        E.MISSING_RPC_URL
      );
    });
  });
});
