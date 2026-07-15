/**
 * Ankr network provider.
 * https://www.ankr.com/
 */

import { NetworkConfig } from "@/network/index.ts";
import type { MainNetConfig, WithArchiveRPC } from "@/network/types.ts";

const rpcUrl = "https://rpc.ankr.com/stellar_soroban";

/** Ankr-backed Mainnet configuration with full archive RPC access. */
export const Ankr = {
  MainNet: () =>
    NetworkConfig.MainNet({
      rpcUrl,
      archiveRpcUrl: rpcUrl,
      allowHttp: false,
    }) as WithArchiveRPC<MainNetConfig>,
};
