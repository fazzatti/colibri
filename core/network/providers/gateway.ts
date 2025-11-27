/**
 *  Gateway network provider.
 *  https://gateway.fm/
 */

import { NetworkConfig } from "@/network/index.ts";

export const Gateway = {
  MainNet: () =>
    NetworkConfig.MainNet({
      rpcUrl: "https://soroban-rpc.mainnet.stellar.gateway.fm/",
      allowHttp: false,
    }),
  TestNet: () =>
    NetworkConfig.TestNet({
      rpcUrl: "https://soroban-rpc.testnet.stellar.gateway.fm/",
      allowHttp: false,
    }),
};
