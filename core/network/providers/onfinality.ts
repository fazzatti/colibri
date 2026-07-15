/**
 * OnFinality network provider.
 * https://onfinality.io/
 */

import { NetworkConfig } from "@/network/index.ts";

/** OnFinality-backed Mainnet configuration preset. */
export const OnFinality = {
  MainNet: () =>
    NetworkConfig.MainNet({
      rpcUrl: "https://stellar.api.onfinality.io/public",
      allowHttp: false,
    }),
};
