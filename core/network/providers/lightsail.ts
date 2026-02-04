/**
 *  Quasar Lightsail network provider.
 *  https://quasar.lightsail.network/
 */

import { NetworkConfig } from "@/network/index.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";
import type { MainNetConfig, WithArchiveRPC } from "@/network/types.ts";

const baseRpcUrl = "https://rpc-pro.lightsail.network/";
const baseArchiveRpcUrl = "https://archive-rpc-pro.lightsail.network/";

export const Lightsail = {
  MainNet: (apiKey?: string) => {
    if (isDefined(apiKey)) {
      return NetworkConfig.MainNet({
        rpcUrl: `${baseRpcUrl}${apiKey}`,
        archiveRpcUrl: `${baseArchiveRpcUrl}${apiKey}`,
        allowHttp: false,
      }) as WithArchiveRPC<MainNetConfig>;
    }
    return NetworkConfig.MainNet({
      rpcUrl: "https://rpc.lightsail.network/",
      archiveRpcUrl: "https://archive-rpc.lightsail.network/",
      allowHttp: false,
    }) as WithArchiveRPC<MainNetConfig>;
  },
};
