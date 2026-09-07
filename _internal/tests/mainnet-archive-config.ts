// deno-coverage-ignore-file
import { NetworkConfig } from "@colibri/core";

/** Repository-only endpoints for real Mainnet event and ledger integration tests. */
export const mainnetArchiveTestConfig = NetworkConfig.MainNet({
  rpcUrl: Deno.env.get("COLIBRI_TEST_MAINNET_RPC_URL") ??
    "https://rpc.lightsail.network/",
  archiveRpcUrl: Deno.env.get("COLIBRI_TEST_MAINNET_ARCHIVE_RPC_URL") ??
    "https://archive-rpc.lightsail.network/",
});
