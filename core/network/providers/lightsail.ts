/**
 *  Quasar Lightsail network provider.
 *  https://quasar.lightsail.network/
 */

import { NetworkConfig } from "@/network/index.ts";

export const Lightsail = {
  MainNet: () =>
    NetworkConfig.MainNet({
      rpcUrl: "https://rpc.lightsail.network/",
      archiveRpcUrl: "https://archive-rpc.lightsail.network/",
      allowHttp: false,
    }),
};
