import { StrKey } from "@colibri/core/strkey";
import type { WalletConnector } from "@/context/config.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
import {
  createWalletConnector,
  createWalletEnvelopeSigner,
} from "@/wallets/adapter.ts";
import type { FreighterApi } from "@/ecosystem/freighter/types.ts";
/** Configuration for the optional Freighter envelope adapter. */
export interface FreighterConnectorOptions {
  /** Connector identifier, defaults to freighter. */
  id?: string;
  /** Non-prompting account/network observation interval, defaults to 2000 ms. */
  pollIntervalMs?: number;
}
/**
 * Connect Freighter without bundling its SDK. Inject the API module from the app.
 * Supports envelope signing; authorization entries and WebAuth require their
 * own explicitly configured capabilities. Polling stops on disconnect.
 */
export function createFreighterConnector(
  api: FreighterApi,
  options: FreighterConnectorOptions = {},
): WalletConnector {
  const interval = options.pollIntervalMs ?? 2000;
  if (!Number.isFinite(interval) || interval < 1) {
    throw new ColibriReactError(
      ReactCode.INVALID_CONFIG,
      "Wallet polling requires a positive interval",
    );
  }
  let lastIdentity: string | undefined;
  const read = async (prompt = false) => {
    const account = await (prompt ? api.requestAccess() : api.getAddress());
    if (account.error) throw account.error;
    if (!account.address) return null;
    const network = await api.getNetworkDetails();
    if (network.error) throw network.error;
    if (!StrKey.isValidEd25519PublicKey(account.address)) {
      throw new ColibriReactError(
        ReactCode.INVALID_CONFIG,
        "Freighter returned an invalid account",
      );
    }
    const publicKey = account.address;
    const signer = createWalletEnvelopeSigner({
      publicKey,
      networkPassphrase: network.networkPassphrase,
      signTransaction: async (xdr, networkPassphrase) => {
        await assertFreighterIdentity(api, publicKey, networkPassphrase);
        const signed = await api.signTransaction(xdr, {
          networkPassphrase,
          address: publicKey,
        });
        if (signed.error) throw signed.error;
        if (signed.signerAddress !== publicKey) {
          throw new ColibriReactError(
            ReactCode.CONNECTION_CHANGED,
            "Freighter returned a different signer",
          );
        }
        await assertFreighterIdentity(api, publicKey, networkPassphrase);
        return signed.signedTxXdr;
      },
    });
    return {
      address: publicKey,
      networkPassphrase: network.networkPassphrase,
      signers: [signer],
    };
  };
  const restore = async (prompt = false) => {
    const connection = await read(prompt);
    lastIdentity = connection
      ? `${connection.address}:${connection.networkPassphrase}`
      : "disconnected";
    return connection;
  };
  return createWalletConnector({
    id: options.id ?? "freighter",
    connect: async () => {
      const connection = await restore(true);
      if (!connection) {
        throw new ColibriReactError(
          ReactCode.CONNECTION_CHANGED,
          "Freighter did not authorize an account",
        );
      }
      return connection;
    },
    reconnect: () => restore(),
    subscribe: (listener) => {
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let previous = lastIdentity;
      const poll = async () => {
        try {
          const connection = await read();
          const identity = connection
            ? `${connection.address}:${connection.networkPassphrase}`
            : "disconnected";
          if (!stopped && identity !== previous) {
            previous = identity;
            listener(connection);
          }
        } catch {
          if (!stopped) {
            previous = "disconnected";
            listener(null);
          }
        }
        if (!stopped) timer = setTimeout(poll, interval);
      };
      timer = setTimeout(poll, interval);
      return () => {
        stopped = true;
        clearTimeout(timer);
      };
    },
  });
}

async function assertFreighterIdentity(
  api: FreighterApi,
  address: string,
  networkPassphrase: string,
): Promise<void> {
  const account = await api.getAddress();
  const network = await api.getNetworkDetails();
  if (account.error) throw account.error;
  if (network.error) throw network.error;
  if (
    account.address !== address ||
    network.networkPassphrase !== networkPassphrase
  ) {
    throw new ColibriReactError(
      ReactCode.CONNECTION_CHANGED,
      "Freighter changed account or network during signing",
    );
  }
}
