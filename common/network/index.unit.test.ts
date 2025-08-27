import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Networks } from "stellar-sdk";
import {
  CustomNet,
  FutureNet,
  MainNet,
  NetworkType,
  TestNet,
  type CustomNetworkPayload,
} from "./index.ts";

describe("Network", () => {
  describe("Default Network Configurations", () => {
    it("should return the TestNet configuration", () => {
      const testNet = TestNet();
      assertEquals(testNet, {
        type: NetworkType.testnet,
        networkPassphrase: Networks.TESTNET,
        rpcUrl: "https://soroban-testnet.stellar.org:443",
        friendbotUrl: "https://friendbot.stellar.org",
        horizonUrl: "https://horizon-testnet.stellar.org",
        allowHttp: false,
      });
    });

    it("should return the FutureNet configuration", () => {
      const futureNet = FutureNet();
      assertEquals(futureNet, {
        type: NetworkType.futurenet,
        networkPassphrase: Networks.FUTURENET,
        rpcUrl: "https://rpc-futurenet.stellar.org:443",
        friendbotUrl: "https://friendbot-futurenet.stellar.org",
        horizonUrl: "https://horizon-futurenet.stellar.org",
        allowHttp: false,
      });
    });

    it("should return the MainNet configuration", () => {
      const mainNet = MainNet();
      assertEquals(mainNet, {
        type: NetworkType.mainnet,
        networkPassphrase: Networks.PUBLIC,
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
        type: NetworkType.custom,
        networkPassphrase: "Custom Network",
        rpcUrl: "https://rpc.custom.com",
        friendbotUrl: "https://friendbot.custom.com",
        horizonUrl: "https://horizon.custom.com",
        allowHttp: true,
      });
    });

    it("should return a custom network configuration with minimal fields", () => {
      const payload: CustomNetworkPayload = {
        networkPassphrase: "Minimal Custom Network",
      };

      const customNet = CustomNet(payload);
      assertEquals(customNet, {
        type: NetworkType.custom,
        networkPassphrase: "Minimal Custom Network",
      });
    });
  });

  describe("NetworkType enum", () => {
    it("should have correct enum values", () => {
      assertEquals(NetworkType.testnet, "testnet");
      assertEquals(NetworkType.futurenet, "futurenet");
      assertEquals(NetworkType.mainnet, "mainnet");
      assertEquals(NetworkType.custom, "custom");
    });
  });
});
