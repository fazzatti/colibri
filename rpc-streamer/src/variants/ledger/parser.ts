import { ColibriError, Ledger as CoreLedger } from "@colibri/core";
import type { Ledger, NetworkConfig, Server } from "@/native-types.ts";
import { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";

/** Shared ledger parsing for live/archive variants. @internal */
export type LedgerParser = (
  rpc: Server,
  entry: Parameters<typeof CoreLedger.fromEntry>[0],
) => Promise<Ledger>;

/** Cache successful network discovery per native RPC connection, never failed requests. @internal */
export function createLedgerParser(network?: NetworkConfig): LedgerParser {
  const configured = network?.networkPassphrase;
  const passphrases = new WeakMap<Server, string>();
  return async (rpc, entry) => {
    let passphrase = configured ?? passphrases.get(rpc);
    if (passphrase === undefined) {
      try {
        passphrase = (await rpc.getNetwork()).passphrase;
      } catch (cause) {
        throw new RPCStreamerError(
          RPCStreamerErrorCode.NETWORK_DISCOVERY_FAILED,
          "Failed to discover the ledger RPC network.",
          undefined,
          cause instanceof Error ? cause : ColibriError.fromUnknown(cause),
        );
      }
      if (typeof passphrase !== "string" || passphrase.length === 0) {
        throw new RPCStreamerError(
          RPCStreamerErrorCode.INVALID_NETWORK_PASSPHRASE,
          "Ledger RPC returned an invalid network passphrase.",
        );
      }
      passphrases.set(rpc, passphrase);
    }
    return CoreLedger.fromEntry(entry, passphrase);
  };
}
