import type { TransactionConfig } from "@colibri/core";
import type { ColibriConfig, WalletConnection } from "@/context/config.ts";
import { assertConnection, guardedSigners } from "@/signers/hooks.ts";
import { ReactUnsupportedCapabilityError } from "@/errors/index.ts";
/** @internal Fill only missing authority fields, preserving every explicit override. */
export async function walletTransactionConfig(
  config: ColibriConfig,
  connection: WalletConnection | undefined,
  overrides: Partial<TransactionConfig> = {},
): Promise<Partial<TransactionConfig>> {
  if (overrides.source !== undefined && overrides.signers !== undefined) {
    return overrides;
  }
  assertConnection(config, connection);
  const { StrKey } = await import("@colibri/core/strkey");
  assertConnection(config, connection);
  const source = overrides.source ?? connection.address;
  if (!StrKey.isValidEd25519PublicKey(source)) {
    throw new ReactUnsupportedCapabilityError(
      "Soroban requires a G-account transaction source; supply source explicitly for contract accounts",
    );
  }
  return {
    ...overrides,
    source,
    signers: overrides.signers ?? [...guardedSigners(config, connection)],
  };
}
