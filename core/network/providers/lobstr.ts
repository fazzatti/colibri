/**
 *  LOBSTR network provider.
 *  https://lobstr.co/
 */

import { NetworkConfig } from "@/network/index.ts";

export const Lobstr = {
  MainNet: () =>
    NetworkConfig.MainNet({
      horizonUrl: "https://horizon.stellar.lobstr.co/",
      allowHttp: false,
    }),
};
