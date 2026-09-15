import type { KitEventType } from "@creit.tech/stellar-wallets-kit/types";
import type { StellarWalletsKitApi } from "@/ecosystem/stellar-wallets-kit/types.ts";

// Check the wire values against upstream enums without importing its runtime/UI.
const state = "STATE_UPDATE" satisfies `${KitEventType.STATE_UPDATED}`;
const wallet = "WALLET_SELECTED" satisfies `${KitEventType.WALLET_SELECTED}`;
const disconnect = "DISCONNECT" satisfies `${KitEventType.DISCONNECT}`;

/** Subscribe without treating Kit's synchronous initial snapshots as changes. */
export function observeKit(
  kit: StellarWalletsKitApi,
  update: () => void,
  invalidate: () => void,
): () => void {
  let starting = true;
  const cleanups: Array<() => void> = [];
  try {
    cleanups.push(kit.on(state as KitEventType.STATE_UPDATED, () => {
      if (!starting) update();
    }));
    cleanups.push(kit.on(wallet as KitEventType.WALLET_SELECTED, () => {
      if (!starting) invalidate();
    }));
    cleanups.push(kit.on(disconnect as KitEventType.DISCONNECT, () => {
      if (!starting) invalidate();
    }));
    starting = false;
    return () => cleanups.forEach((cleanup) => cleanup());
  } catch (error) {
    cleanups.forEach((cleanup) => cleanup());
    throw error;
  }
}
