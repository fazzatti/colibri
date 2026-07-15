import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Ankr } from "@/network/providers/ankr.ts";
import { Gateway } from "@/network/providers/gateway.ts";
import { Lightsail } from "@/network/providers/lightsail.ts";
import { OnFinality } from "@/network/providers/onfinality.ts";

describe("Network provider configurations", () => {
  it("builds Gateway public configurations", () => {
    assertEquals(
      Gateway.MainNet().rpcUrl,
      "https://soroban-rpc.mainnet.stellar.gateway.fm/",
    );
    assertEquals(
      Gateway.TestNet().rpcUrl,
      "https://soroban-rpc.testnet.stellar.gateway.fm/",
    );
  });

  it("builds Lightsail public and PRO configurations", () => {
    const publicConfig = Lightsail.MainNet();
    assertEquals(publicConfig.rpcUrl, "https://rpc.lightsail.network/");
    assertEquals(
      publicConfig.archiveRpcUrl,
      "https://archive-rpc.lightsail.network/",
    );

    const proConfig = Lightsail.MainNet("api-key");
    assertEquals(proConfig.rpcUrl, "https://rpc-pro.lightsail.network/api-key");
    assertEquals(
      proConfig.archiveRpcUrl,
      "https://archive-rpc-pro.lightsail.network/api-key",
    );
  });

  it("builds OnFinality's public Mainnet configuration", () => {
    assertEquals(
      OnFinality.MainNet().rpcUrl,
      "https://stellar.api.onfinality.io/public",
    );
  });

  it("builds Ankr's public full-archive Mainnet configuration", () => {
    const config = Ankr.MainNet();
    assertEquals(config.rpcUrl, "https://rpc.ankr.com/stellar_soroban");
    assertEquals(config.archiveRpcUrl, config.rpcUrl);
  });
});
