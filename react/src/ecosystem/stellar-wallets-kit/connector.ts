import { StrKey } from "@colibri/core/strkey";
import type { WalletConnection, WalletConnector } from "@/context/config.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
import { createWalletEnvelopeSigner } from "@/wallets/adapter.ts";
import {
  connectionChanged,
  readKitAccount,
  sameKitAccount,
} from "@/ecosystem/stellar-wallets-kit/identity.ts";
import { observeKit } from "@/ecosystem/stellar-wallets-kit/events.ts";
import type {
  StellarWalletsKitApi,
  StellarWalletsKitConnectorOptions,
  WalletsKitAccount,
  WalletsKitCapabilities,
} from "@/ecosystem/stellar-wallets-kit/types.ts";

/**
 * Adapt an application-initialized Wallets Kit without importing its runtime.
 * Explicitly declare supported capabilities per module. Module switches and
 * disconnect events invalidate the connection; reconnect through an explicit
 * connect action after switching, because Kit can retain the previous address.
 */
export function createStellarWalletsKitConnector(
  kit: StellarWalletsKitApi,
  options: StellarWalletsKitConnectorOptions,
): WalletConnector {
  return new KitConnector(kit, options);
}

/** Internal lifecycle; one connector should own an application's Kit instance. */
class KitConnector implements WalletConnector {
  readonly id: string;
  private revision = 0;
  private blocked = false;
  private account: WalletsKitAccount | null = null;

  constructor(
    private readonly kit: StellarWalletsKitApi,
    private readonly options: StellarWalletsKitConnectorOptions,
  ) {
    this.id = options.id ?? "stellar-wallets-kit";
  }

  async connect(): Promise<WalletConnection> {
    const revision = ++this.revision;
    const result = await (this.options.connect?.() ?? this.kit.authModal());
    const account = await readKitAccount(this.kit);
    if (
      revision !== this.revision || !account ||
      account.address !== result.address
    ) {
      throw connectionChanged();
    }
    this.blocked = false;
    this.account = account;
    return this.connection(account);
  }

  async reconnect(): Promise<WalletConnection | null> {
    if (this.blocked) return null;
    const revision = ++this.revision;
    const account = await readKitAccount(this.kit);
    if (revision !== this.revision) throw connectionChanged();
    this.account = account;
    return account && this.connection(account);
  }

  async disconnect(): Promise<void> {
    this.invalidate();
    await this.kit.disconnect();
  }

  private invalidate(): void {
    ++this.revision;
    this.blocked = true;
    this.account = null;
  }

  private async assertAccount(
    account: WalletsKitAccount,
    revision: number,
  ): Promise<void> {
    if (this.blocked || revision !== this.revision) throw connectionChanged();
    const current = await readKitAccount(this.kit);
    if (revision !== this.revision || !sameKitAccount(current, account)) {
      throw connectionChanged();
    }
  }

  private connection(account: WalletsKitAccount): WalletConnection {
    const capabilities = this.options.capabilities(account);
    const signers = [...(capabilities.signers ?? [])];
    if (capabilities.envelope) signers.unshift(this.envelope(account));
    if (capabilities.authEntry) {
      signers.push(this.authEntry(account, capabilities.authEntry));
    }
    return {
      address: account.address,
      networkPassphrase: account.networkPassphrase,
      signers,
      messageSigner: capabilities.messageSigner,
    };
  }

  private authEntry(
    account: WalletsKitAccount,
    create: NonNullable<WalletsKitCapabilities["authEntry"]>,
  ) {
    const { address, networkPassphrase } = account;
    if (!this.kit.signAuthEntry || !StrKey.isValidEd25519PublicKey(address)) {
      throw new ColibriReactError(
        ReactCode.UNSUPPORTED_CAPABILITY,
        "Kit auth-entry signing requires a G-address and signAuthEntry capability",
      );
    }
    const sign = this.kit.signAuthEntry.bind(this.kit);
    const revision = this.revision;
    return create({
      address,
      networkPassphrase,
      signAuthEntry: async (xdr) => {
        await this.assertAccount(account, revision);
        const signed = await sign(xdr, { address, networkPassphrase });
        if (signed.signerAddress && signed.signerAddress !== address) {
          throw connectionChanged();
        }
        await this.assertAccount(account, revision);
        return signed.signedAuthEntry;
      },
    });
  }

  private envelope(account: WalletsKitAccount) {
    const { address, networkPassphrase } = account;
    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new ColibriReactError(
        ReactCode.UNSUPPORTED_CAPABILITY,
        "Kit envelope signing requires a G-address; supply explicit signers for other accounts",
      );
    }
    const revision = this.revision;
    return createWalletEnvelopeSigner({
      publicKey: address,
      networkPassphrase,
      signTransaction: async (xdr) => {
        await this.assertAccount(account, revision);
        const signed = await this.kit.signTransaction(xdr, {
          address,
          networkPassphrase,
        });
        if (signed.signerAddress && signed.signerAddress !== address) {
          throw connectionChanged();
        }
        await this.assertAccount(account, revision);
        return signed.signedTxXdr;
      },
    });
  }

  subscribe(
    listener: (connection: WalletConnection | null) => void,
  ): () => void {
    let stopped = false;
    let request = 0;
    const refresh = async (changed: boolean) => {
      const current = ++request;
      if (changed) {
        ++this.revision;
        listener(null);
      }
      try {
        if (this.blocked) return;
        const account = await readKitAccount(this.kit);
        if (stopped || current !== request || this.blocked) return;
        if (!changed && sameKitAccount(account, this.account)) return;
        this.account = account;
        listener(account && this.connection(account));
      } catch {
        if (!stopped && current === request) listener(null);
      }
    };
    const cleanup = observeKit(this.kit, () => void refresh(true), () => {
      ++request;
      this.invalidate();
      listener(null);
    });
    // Close the gap between the initial connection read and listener registration.
    void refresh(false);
    return () => {
      stopped = true;
      ++request;
      cleanup();
    };
  }
}
