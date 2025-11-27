import { assert, assertEquals, assertThrows } from "@std/assert";
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

    it("should identify CustomNet configuration", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Custom Network",
        rpcUrl: "https://rpc.custom.com",
      });
      assert(customNet.isCustomNet());
      assert(!NetworkConfig.TestNet().isCustomNet());
    });

    it("should identify CustomNet via fallback when type is not CUSTOM but passphrase mismatches", () => {
      // Create a config with TESTNET type but wrong passphrase
      // This exercises the fallback path: !isTestNet() && !isFutureNet() && !isMainNet()
      const customNet = NetworkConfig.CustomNet({
        type: NetworkType.TESTNET,
        networkPassphrase: "Wrong Passphrase",
        rpcUrl: "https://rpc.custom.com",
      });
      // isTestNet() returns false because passphrase doesn't match
      assert(!customNet.isTestNet());
      // But isCustomNet() should return true via the fallback path
      assert(customNet.isCustomNet());
    });
  });

  describe("Custom URL overrides", () => {
    it("TestNet should accept custom URLs", () => {
      const testNet = NetworkConfig.TestNet({
        rpcUrl: "https://custom-rpc.testnet.com",
        horizonUrl: "https://custom-horizon.testnet.com",
        friendbotUrl: "https://custom-friendbot.testnet.com",
        archiveRpcUrl: "https://custom-archive.testnet.com",
        allowHttp: true,
      });

      assertEquals(testNet.rpcUrl, "https://custom-rpc.testnet.com");
      assertEquals(testNet.horizonUrl, "https://custom-horizon.testnet.com");
      assertEquals(
        testNet.friendbotUrl,
        "https://custom-friendbot.testnet.com"
      );
      assertEquals(testNet.archiveRpcUrl, "https://custom-archive.testnet.com");
      assertEquals(testNet.allowHttp, true);
    });

    it("FutureNet should accept custom URLs", () => {
      const futureNet = NetworkConfig.FutureNet({
        rpcUrl: "https://custom-rpc.futurenet.com",
        horizonUrl: "https://custom-horizon.futurenet.com",
        friendbotUrl: "https://custom-friendbot.futurenet.com",
        archiveRpcUrl: "https://custom-archive.futurenet.com",
        allowHttp: true,
      });

      assertEquals(futureNet.rpcUrl, "https://custom-rpc.futurenet.com");
      assertEquals(
        futureNet.horizonUrl,
        "https://custom-horizon.futurenet.com"
      );
      assertEquals(
        futureNet.friendbotUrl,
        "https://custom-friendbot.futurenet.com"
      );
      assertEquals(
        futureNet.archiveRpcUrl,
        "https://custom-archive.futurenet.com"
      );
      assertEquals(futureNet.allowHttp, true);
    });

    it("MainNet should accept custom URLs", () => {
      const mainNet = NetworkConfig.MainNet({
        rpcUrl: "https://custom-rpc.mainnet.com",
        horizonUrl: "https://custom-horizon.mainnet.com",
        archiveRpcUrl: "https://custom-archive.mainnet.com",
        allowHttp: true,
      });

      assertEquals(mainNet.rpcUrl, "https://custom-rpc.mainnet.com");
      assertEquals(mainNet.horizonUrl, "https://custom-horizon.mainnet.com");
      assertEquals(mainNet.archiveRpcUrl, "https://custom-archive.mainnet.com");
      assertEquals(mainNet.allowHttp, true);
    });

    it("CustomNet should accept all optional fields", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Custom Network",
        rpcUrl: "https://rpc.custom.com",
        archiveRpcUrl: "https://archive-rpc.custom.com",
        horizonUrl: "https://horizon.custom.com",
        friendbotUrl: "https://friendbot.custom.com",
        allowHttp: true,
      });

      assertEquals(customNet.archiveRpcUrl, "https://archive-rpc.custom.com");
      assertEquals(customNet.friendbotUrl, "https://friendbot.custom.com");
      assertEquals(customNet.allowHttp, true);
    });
  });

  describe("Property setters", () => {
    it("should set type on CustomNet", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      // type is already set, so this should throw
      assertThrows(
        () => {
          customNet.type = NetworkType.TESTNET;
        },
        Error,
        "already set"
      );
    });

    it("should set networkPassphrase on CustomNet", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      // networkPassphrase is already set, so this should throw
      assertThrows(
        () => {
          customNet.networkPassphrase = "New Passphrase";
        },
        Error,
        "already set"
      );
    });

    it("should set rpcUrl on CustomNet without rpcUrl", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
        horizonUrl: "https://horizon.test.com",
      });
      customNet.rpcUrl = "https://rpc.test.com";
      assertEquals(customNet.rpcUrl, "https://rpc.test.com");
    });

    it("should throw when setting rpcUrl twice", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
        rpcUrl: "https://rpc.test.com",
      });
      assertThrows(
        () => {
          customNet.rpcUrl = "https://rpc2.test.com";
        },
        Error,
        "already set"
      );
    });

    it("should set archiveRpcUrl on CustomNet", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      customNet.archiveRpcUrl = "https://archive.test.com";
      assertEquals(customNet.archiveRpcUrl, "https://archive.test.com");
    });

    it("should throw when setting archiveRpcUrl twice", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
        archiveRpcUrl: "https://archive.test.com",
      });
      assertThrows(
        () => {
          customNet.archiveRpcUrl = "https://archive2.test.com";
        },
        Error,
        "already set"
      );
    });

    it("should set horizonUrl on CustomNet", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      customNet.horizonUrl = "https://horizon.test.com";
      assertEquals(customNet.horizonUrl, "https://horizon.test.com");
    });

    it("should throw when setting horizonUrl twice", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
        horizonUrl: "https://horizon.test.com",
      });
      assertThrows(
        () => {
          customNet.horizonUrl = "https://horizon2.test.com";
        },
        Error,
        "already set"
      );
    });

    it("should set friendbotUrl on CustomNet", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      customNet.friendbotUrl = "https://friendbot.test.com";
      assertEquals(customNet.friendbotUrl, "https://friendbot.test.com");
    });

    it("should throw when setting friendbotUrl twice", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
        friendbotUrl: "https://friendbot.test.com",
      });
      assertThrows(
        () => {
          customNet.friendbotUrl = "https://friendbot2.test.com";
        },
        Error,
        "already set"
      );
    });

    it("should set allowHttp on CustomNet", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      customNet.allowHttp = true;
      assertEquals(customNet.allowHttp, true);
    });

    it("should throw when setting allowHttp twice", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
        allowHttp: false,
      });
      assertThrows(
        () => {
          customNet.allowHttp = true;
        },
        Error,
        "already set"
      );
    });
  });

  describe("require() error handling", () => {
    it("should throw when accessing type on corrupted config", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      // Forcibly unset the private _type field to simulate a corrupted state
      // This tests the require() throw path
      // deno-lint-ignore no-explicit-any
      (customNet as any)._type = undefined;
      assertThrows(
        () => customNet.type,
        Error,
        "Property _type is not set in the Network Config instance"
      );
    });

    it("should throw when accessing networkPassphrase on corrupted config", () => {
      const customNet = NetworkConfig.CustomNet({
        networkPassphrase: "Test",
      });
      // Forcibly unset the private _networkPassphrase field
      // deno-lint-ignore no-explicit-any
      (customNet as any)._networkPassphrase = undefined;
      assertThrows(
        () => customNet.networkPassphrase,
        Error,
        "Property _networkPassphrase is not set in the Network Config instance"
      );
    });
  });
});
