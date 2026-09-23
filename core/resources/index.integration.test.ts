import { assert } from "@std/assert";
import { Server } from "stellar-sdk/rpc";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { NetworkConfig } from "@/network/index.ts";
import { getNetworkResourceSettings } from "@/resources/settings.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("RPC resource settings", () => {
  it("reads native Testnet configuration XDR without submitting a transaction", async () => {
    const network = NetworkConfig.TestNet();
    const result = await getNetworkResourceSettings({
      rpc: new Server(network.rpcUrl!),
    });
    assert(result.networkPassphrase === network.networkPassphrase);
    assert(result.latestLedger > 0);
    assert(result.protocolVersion >= 23);
    assert(result.limits.instructions > 0);
    assert(result.limits.writeBytes > 0);
    assert(BigInt(result.fees.perWrite1KB) >= 0n);
  });
});
