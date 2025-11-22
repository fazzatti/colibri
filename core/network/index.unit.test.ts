import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { NetworkType, NetworkPassphrase } from "@/network/types.ts";
import { isNetworkConfig, NetworkConfig } from "@/network/index.ts";

describe("Network", () => {
  describe("Default Network Configurations", () => {
    it("should return the TestNet configuration", () => {
      const testNet = NetworkConfig.TestNet();

      assertEquals(testNet.type, NetworkType.TESTNET);
      assertEquals(testNet.networkPassphrase, NetworkPassphrase.TESTNET);
      assertEquals(testNet.rpcUrl, "https://soroban-testnet.stellar.org:443");
      assertEquals(testNet.friendbotUrl, "https://friendbot.stellar.org");
      assertEquals(testNet.horizonUrl, "https://horizon-testnet.stellar.org");
      assertEquals(testNet.allowHttp, false);
    });

    it("should return the FutureNet configuration", () => {
      const futureNet = NetworkConfig.FutureNet();
      assertEquals(futureNet.type, NetworkType.FUTURENET);
      assertEquals(futureNet.networkPassphrase, NetworkPassphrase.FUTURENET);
      assertEquals(futureNet.rpcUrl, "https://rpc-futurenet.stellar.org:443");
      assertEquals(
        futureNet.friendbotUrl,
        "https://friendbot-futurenet.stellar.org"
      );
      assertEquals(
        futureNet.horizonUrl,
        "https://horizon-futurenet.stellar.org"
      );
      assertEquals(futureNet.allowHttp, false);
    });

    it("should return the MainNet configuration", () => {
      const mainNet = NetworkConfig.MainNet();
      assertEquals(mainNet.type, NetworkType.MAINNET);
      assertEquals(mainNet.networkPassphrase, NetworkPassphrase.MAINNET);
      assertEquals(mainNet.rpcUrl, "https://mainnet.sorobanrpc.com");
      assertEquals(mainNet.horizonUrl, "https://horizon.stellar.org");
      assertEquals(mainNet.allowHttp, false);
    });
  });

  describe("Custom Network Configuration", () => {
    it("should return a custom network configuration with all fields", () => {
      const payload = {
        networkPassphrase: "Custom Network",
        rpcUrl: "https://rpc.custom.com",
        friendbotUrl: "https://friendbot.custom.com",
        horizonUrl: "https://horizon.custom.com",
        allowHttp: true,
      };

      const customNet = NetworkConfig.CustomNet(payload);

      assertEquals(customNet.type, NetworkType.CUSTOM);
      assertEquals(customNet.networkPassphrase, "Custom Network");
      assertEquals(customNet.rpcUrl, "https://rpc.custom.com");
      assertEquals(customNet.friendbotUrl, "https://friendbot.custom.com");
      assertEquals(customNet.horizonUrl, "https://horizon.custom.com");
      assertEquals(customNet.allowHttp, true);
    });

    it("should return a custom network configuration with minimal fields", () => {
      const payloadWithHorizon = {
        networkPassphrase: "Minimal Custom Network",
        horizonUrl: "https://horizon.minimal.com",
      };

      const customNet = NetworkConfig.CustomNet(payloadWithHorizon);
      assertEquals(customNet.type, NetworkType.CUSTOM);
      assertEquals(customNet.networkPassphrase, "Minimal Custom Network");
      assertEquals(customNet.horizonUrl, "https://horizon.minimal.com");

      const payloadWithRpc = {
        networkPassphrase: "Minimal Custom Network",
        rpcUrl: "https://rpc.minimal.com",
      };

      const customNetRpc = NetworkConfig.CustomNet(payloadWithRpc);
      assertEquals(customNetRpc.type, NetworkType.CUSTOM);
      assertEquals(customNetRpc.networkPassphrase, "Minimal Custom Network");
      assertEquals(customNetRpc.rpcUrl, "https://rpc.minimal.com");
    });

    it("should respect explicitly provided type overrides", () => {
      const customNet = NetworkConfig.CustomNet({
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
    it("should identify various configurations of NetworkConfig", () => {
      assert(isNetworkConfig(NetworkConfig.TestNet()));
      assert(isNetworkConfig(NetworkConfig.FutureNet()));
      assert(isNetworkConfig(NetworkConfig.MainNet()));
      assert(
        isNetworkConfig(
          NetworkConfig.CustomNet({
            networkPassphrase: "Some Custom Network",
            rpcUrl: "https://rpc.custom.com",
          })
        )
      );

      assert(
        !isNetworkConfig({
          rpcUrl: "https://rpc.missingtype.com",
        })
      );

      assert(
        !isNetworkConfig({
          type: "invalidtype" as NetworkType,
          networkPassphrase: "Invalid Type Network",
          rpcUrl: "https://rpc.invalid.com",
        })
      );
    });

    it("should identify TestNet configuration", () => {
      assert(NetworkConfig.TestNet().isTestNet());
      assert(!NetworkConfig.MainNet().isTestNet());
    });

    it("should identify FutureNet configuration", () => {
      assert(NetworkConfig.FutureNet().isFutureNet());
      assert(!NetworkConfig.TestNet().isFutureNet());
    });

    it("should identify MainNet configuration", () => {
      assert(NetworkConfig.MainNet().isMainNet());
      assert(!NetworkConfig.FutureNet().isMainNet());
    });
  });
});
