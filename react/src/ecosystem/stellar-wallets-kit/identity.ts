import { ColibriReactError, ReactCode } from "@/errors/index.ts";
import type {
  StellarWalletsKitApi,
  WalletsKitAccount,
} from "@/ecosystem/stellar-wallets-kit/types.ts";

/** Kit's documented empty cached-address error. Other failures retain their identity. */
function hasCode(error: unknown, code: number): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    error.code === code;
}

/** Read cached account plus wallet network without invoking fetchAddress or a modal. */
export async function readKitAccount(
  kit: StellarWalletsKitApi,
): Promise<WalletsKitAccount | null> {
  let module;
  try {
    module = kit.selectedModule;
  } catch (error) {
    if (hasCode(error, -3)) return null;
    throw error;
  }
  let address: string;
  try {
    ({ address } = await kit.getAddress());
  } catch (error) {
    if (hasCode(error, -1)) return null;
    throw error;
  }
  if (!address) return null;
  const { networkPassphrase } = await kit.getNetwork();
  if (!networkPassphrase) {
    throw new ColibriReactError(
      ReactCode.INVALID_CONFIG,
      "Wallet network is missing",
    );
  }
  if (
    kit.selectedModule !== module ||
    (await kit.getAddress()).address !== address
  ) throw connectionChanged();
  return { address, networkPassphrase, module };
}

/** Compare actual module identity as well as account/network. */
export function sameKitAccount(
  a: WalletsKitAccount | null,
  b: WalletsKitAccount | null,
): boolean {
  return a === b || (a !== null && b !== null && a.module === b.module &&
    a.address === b.address && a.networkPassphrase === b.networkPassphrase);
}

/** A retained capability must never silently switch to another wallet or account. */
export function connectionChanged(): ColibriReactError {
  return new ColibriReactError(
    ReactCode.CONNECTION_CHANGED,
    "Wallets Kit account, module or network changed",
  );
}
