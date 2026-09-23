import type { xdr } from "stellar-sdk";
import { buildConfigSettingLedgerKey } from "@/ledger-entries/keys.ts";
import type { ConfigSettingIdName } from "@/ledger-entries/types.ts";
import type {
  GetNetworkResourceSettingsInput,
  NetworkResourceSettings,
} from "@/resources/types.ts";
import * as ERROR from "@/resources/error.ts";

const IDS = [
  "configSettingContractComputeV0",
  "configSettingContractLedgerCostV0",
  "configSettingContractLedgerCostExtV0",
] as const satisfies readonly ConfigSettingIdName[];

function readSetting<T extends xdr.ConfigSettingEntry["type"]>(
  entries: readonly { val: xdr.LedgerEntryData }[],
  type: T,
): Extract<xdr.ConfigSettingEntry, { type: T }> {
  const matches = entries.filter(({ val }) =>
    val.type === "configSetting" && val.configSetting.type === type
  );
  if (matches.length !== 1 || matches[0].val.type !== "configSetting") {
    throw new ERROR.SETTINGS_UNAVAILABLE(type);
  }
  return matches[0].val.configSetting as Extract<
    xdr.ConfigSettingEntry,
    { type: T }
  >;
}

/**
 * Reads scalar transaction resource limits and fee rates through Stellar RPC.
 *
 * Batches the three configuration entries in one ledger read; getNetwork is a
 * separate observation, not an atomic protocol/settings snapshot. Requires the
 * ledger-cost extension setting (Protocol 23+). Missing settings fail explicitly.
 * This does not fetch a complete rent quote or infer future contract workload.
 *
 * @param input - Caller-owned RPC client.
 * @returns Normalized limits, decimal stroop rates, and observation provenance.
 * @throws {ResourceErrors.SETTINGS_UNAVAILABLE} If required settings cannot be read.
 */
export async function getNetworkResourceSettings(
  { rpc }: GetNetworkResourceSettingsInput,
): Promise<NetworkResourceSettings> {
  try {
    const [network, response] = await Promise.all([
      rpc.getNetwork(),
      rpc.getLedgerEntries(
        ...IDS.map((configSettingId) =>
          buildConfigSettingLedgerKey({ configSettingId })
        ),
      ),
    ]);
    const compute = readSetting(response.entries, IDS[0]).contractCompute;
    const ledger = readSetting(response.entries, IDS[1]).contractLedgerCost;
    const extension =
      readSetting(response.entries, IDS[2]).contractLedgerCostExt;
    const settings: NetworkResourceSettings = {
      networkPassphrase: network.passphrase,
      protocolVersion: Number(network.protocolVersion),
      latestLedger: response.latestLedger,
      limits: {
        instructions: Number(compute.txMaxInstructions),
        diskReadBytes: ledger.txMaxDiskReadBytes,
        writeBytes: ledger.txMaxWriteBytes,
        memoryBytes: compute.txMemoryLimit,
        footprintEntries: extension.txMaxFootprintEntries,
      },
      fees: {
        perInstructionIncrement: compute.feeRatePerInstructionsIncrement
          .toString(),
        perDiskRead1KB: ledger.feeDiskRead1Kb.toString(),
        perWrite1KB: extension.feeWrite1Kb.toString(),
      },
    };
    if (
      !Number.isSafeInteger(settings.protocolVersion) ||
      settings.protocolVersion < 23 ||
      Object.values(settings.limits).some((v) =>
        !Number.isSafeInteger(v) || v < 0
      ) ||
      Object.values(settings.fees).some((v) => !/^\d+$/.test(v))
    ) {
      throw new ERROR.SETTINGS_UNAVAILABLE("invalid limits or fee rates");
    }
    return settings;
  } catch (cause) {
    if (cause instanceof ERROR.ResourceError) throw cause;
    throw new ERROR.SETTINGS_UNAVAILABLE("RPC configuration read", cause);
  }
}
