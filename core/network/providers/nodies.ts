/**
 *  Nodies network provider.
 *  https://www.nodies.app/
 */

import { NetworkConfig } from "@/network/index.ts";

export const Nodies = {
  MainNet: () =>
    NetworkConfig.MainNet({
      rpcUrl: "https://stellar-soroban-public.nodies.app/",
      allowHttp: false,
    }),
  TestNet: () =>
    NetworkConfig.TestNet({
      rpcUrl: "https://stellar-soroban-testnet-public.nodies.app/",
      allowHttp: false,
    }),
};
