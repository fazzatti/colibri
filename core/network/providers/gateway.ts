/**
 *  Gateway network provider.
 *  https://gateway.fm/
 */

import { NetworkConfig } from "@/network/index.ts";
import type { MainNetConfig, TestNetConfig } from "@/network/types.ts";

/** Gateway.fm-backed network configuration presets. */
export const Gateway = {
  MainNet: (): MainNetConfig =>
    NetworkConfig.MainNet({
      rpcUrl: "https://soroban-rpc.mainnet.stellar.gateway.fm/",
      allowHttp: false,
    }),
  TestNet: (): TestNetConfig =>
    NetworkConfig.TestNet({
      rpcUrl: "https://soroban-rpc.testnet.stellar.gateway.fm/",
      allowHttp: false,
    }),
};
