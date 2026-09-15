/// <reference lib="dom" />
/** Actual vendor types, plus browser execution of Kit's real state/event machinery. */
import type * as Freighter from "npm:@stellar/freighter-api@^6.0.1";
import type { StellarWalletsKit } from "npm:@creit.tech/stellar-wallets-kit@^2.6.0/sdk";
import type { ModuleInterface } from "npm:@creit.tech/stellar-wallets-kit@^2.6.0/types";
import { createFreighterConnector } from "@colibri/react/ecosystem/freighter";
import { createStellarWalletsKitConnector } from "@colibri/react/ecosystem/stellar-wallets-kit";
import { createColibriConfig } from "@colibri/react";
import { NetworkConfig } from "@colibri/core/network";
import type { EnvelopeSigner } from "@colibri/core/signers";
import { Account, Keypair, TransactionBuilder } from "stellar-sdk/base";

type IsAny<T> = 0 extends (1 & T) ? true : false;
type FreighterInput = Parameters<typeof createFreighterConnector>[0];
type KitInput = Parameters<typeof createStellarWalletsKitConnector>[0];
// Reject declaration emitters that erase upstream signatures into any.
const preciseWalletTypes: [false, false, false, false] = [
  false as IsAny<FreighterInput>,
  false as IsAny<Parameters<FreighterInput["signTransaction"]>[0]>,
  false as IsAny<KitInput>,
  false as IsAny<ReturnType<KitInput["getNetwork"]>>,
];
void preciseWalletTypes;

/** Compile against actual SDK exports, not hand-copied vendor declarations. */
export function acceptWalletSdks(
  freighter: typeof Freighter,
  kit: typeof StellarWalletsKit,
) {
  return [
    createFreighterConnector(freighter),
    createStellarWalletsKitConnector(kit, {
      capabilities: () => ({ envelope: true }),
    }),
  ];
}

if (typeof document !== "undefined") {
  const { StellarWalletsKit: kit } = await import(
    "npm:@creit.tech/stellar-wallets-kit@^2.6.0/sdk"
  );
  const { ModuleType, Networks } = await import(
    "npm:@creit.tech/stellar-wallets-kit@^2.6.0/types"
  );
  const key = Keypair.random();
  let address = key.publicKey();
  const module: ModuleInterface = {
    productId: "colibri-fixture",
    productName: "Offline compatibility fixture",
    productUrl: "https://example.invalid",
    productIcon: "",
    moduleType: ModuleType.HOT_WALLET,
    isAvailable: () => Promise.resolve(true),
    getAddress: () => Promise.resolve({ address }),
    getNetwork: () =>
      Promise.resolve({
        network: "TESTNET",
        networkPassphrase: Networks.TESTNET,
      }),
    signTransaction: (xdr) => {
      const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      tx.sign(key);
      return Promise.resolve({
        signedTxXdr: tx.toXDR(),
        signerAddress: key.publicKey(),
      });
    },
    signAuthEntry: () =>
      Promise.reject(new Error("unsupported fixture capability")),
    signMessage: () =>
      Promise.reject(new Error("unsupported fixture capability")),
  };
  kit.init({
    modules: [module, { ...module, productId: "other-fixture" }],
    network: Networks.TESTNET,
    selectedWalletId: module.productId,
  });
  const connector = createStellarWalletsKitConnector(kit, {
    connect: () => kit.fetchAddress(),
    capabilities: ({ module: selected }) => ({
      envelope: selected.productId === module.productId,
    }),
  });
  const config = createColibriConfig({
    network: NetworkConfig.TestNet(),
    connectors: [connector],
  });
  try {
    const connection = await config.connect(connector.id);
    const signer = connection!.signers[0] as EnvelopeSigner;
    const tx = new TransactionBuilder(new Account(address, "1"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    }).setTimeout(0).build();
    const signed = TransactionBuilder.fromXDR(
      await signer.signTransaction(tx),
      Networks.TESTNET,
    );
    if (!key.verify(signed.hash(), signed.signatures[0].signature)) {
      throw new Error("Kit envelope signature mismatch");
    }
    address = Keypair.random().publicKey();
    await kit.fetchAddress();
    for (
      let i = 0;
      i < 20 && config.getSnapshot().connection?.address !== address;
      i++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    if (config.getSnapshot().connection?.address !== address) {
      throw new Error("Kit account event was not adapted");
    }
    kit.setWallet("other-fixture");
    if (config.getSnapshot().connection) {
      throw new Error("Kit module switch retained stale authority");
    }
    await config.disconnect();
  } finally {
    config.destroy();
    await kit.disconnect();
  }
  console.log(
    "Actual Wallets Kit SDK: connection, envelope signature, account events, module switch and cleanup passed.",
  );
}
