import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import {
  CustomNet,
  FutureNet,
  MainNet,
  NetworkType,
  TestNet,
  NetworkPassphrase,
  type CustomNetworkPayload,
  isFutureNet,
  isMainNet,
  isTestNet,
} from "./index.ts";

describe("Network", () => {
  describe("Default Network Configurations", () => {
    it("should return the TestNet configuration", () => {
      const testNet = TestNet();
      assertEquals(testNet, {
        type: NetworkType.TESTNET,
        networkPassphrase: NetworkPassphrase.TESTNET,
        rpcUrl: "https://soroban-testnet.stellar.org:443",
        friendbotUrl: "https://friendbot.stellar.org",
        horizonUrl: "https://horizon-testnet.stellar.org",
        allowHttp: false,
      });
    });

    it("should return the FutureNet configuration", () => {
      const futureNet = FutureNet();
      assertEquals(futureNet, {
        type: NetworkType.FUTURENET,
        networkPassphrase: NetworkPassphrase.FUTURENET,
        rpcUrl: "https://rpc-futurenet.stellar.org:443",
        friendbotUrl: "https://friendbot-futurenet.stellar.org",
        horizonUrl: "https://horizon-futurenet.stellar.org",
        allowHttp: false,
      });
    });

    it("should return the MainNet configuration", () => {
      const mainNet = MainNet();
      assertEquals(mainNet, {
        type: NetworkType.MAINNET,
        networkPassphrase: NetworkPassphrase.MAINNET,
        rpcUrl: "",
        horizonUrl: "https://horizon.stellar.org",
        allowHttp: false,
      });
    });
  });

  describe("Custom Network Configuration", () => {
    it("should return a custom network configuration with all fields", () => {
      const payload: CustomNetworkPayload = {
        networkPassphrase: "Custom Network",
        rpcUrl: "https://rpc.custom.com",
        friendbotUrl: "https://friendbot.custom.com",
        horizonUrl: "https://horizon.custom.com",
        allowHttp: true,
      };

      const customNet = CustomNet(payload);
      assertEquals(customNet, {
        type: NetworkType.CUSTOM,
        networkPassphrase: "Custom Network",
        rpcUrl: "https://rpc.custom.com",
        friendbotUrl: "https://friendbot.custom.com",
        horizonUrl: "https://horizon.custom.com",
        allowHttp: true,
      });
    });

    it("should return a custom network configuration with minimal fields", () => {
      const payloadWithHorizon: CustomNetworkPayload = {
        networkPassphrase: "Minimal Custom Network",
        horizonUrl: "https://horizon.minimal.com",
      };

      const customNet = CustomNet(payloadWithHorizon);
      assertEquals(customNet, {
        type: NetworkType.CUSTOM,
        networkPassphrase: "Minimal Custom Network",
        horizonUrl: "https://horizon.minimal.com",
      });

      const payloadWithRpc: CustomNetworkPayload = {
        networkPassphrase: "Minimal Custom Network",
        rpcUrl: "https://rpc.minimal.com",
      };

      const customNetRpc = CustomNet(payloadWithRpc);
      assertEquals(customNetRpc, {
        type: NetworkType.CUSTOM,
        networkPassphrase: "Minimal Custom Network",
        rpcUrl: "https://rpc.minimal.com",
      });
    });

    it("should respect explicitly provided type overrides", () => {
      const customNet = CustomNet({
        type: NetworkType.TESTNET,
        networkPassphrase: "Override",
        rpcUrl: "http://localhost:8000",
        allowHttp: true,
      });

      assertEquals(customNet.type, NetworkType.TESTNET);
      assertEquals(customNet.rpcUrl, "http://localhost:8000");
      assertEquals(customNet.allowHttp, true);
    });
  });

  describe("NetworkType enum", () => {
    it("should have correct enum values", () => {
      assertEquals(NetworkType.TESTNET, "testnet");
      assertEquals(NetworkType.FUTURENET, "futurenet");
      assertEquals(NetworkType.MAINNET, "mainnet");
      assertEquals(NetworkType.CUSTOM, "custom");
    });
  });

  describe("Type guard helpers", () => {
    it("should identify TestNet configuration", () => {
      assert(isTestNet(TestNet()));
      assert(!isTestNet(MainNet()));
    });

    it("should identify FutureNet configuration", () => {
      assert(isFutureNet(FutureNet()));
      assert(!isFutureNet(TestNet()));
    });

    it("should identify MainNet configuration", () => {
      assert(isMainNet(MainNet()));
      assert(!isMainNet(FutureNet()));
    });
  });
});
