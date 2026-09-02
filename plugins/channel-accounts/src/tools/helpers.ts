import {
  type KeypairSigner,
  LocalSigner,
  NativeAccount,
  type SignableTransaction,
  StrKey,
} from "@colibri/core";
import type { xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import type {
  ChannelAccount,
  OpenChannelsArgs,
} from "@/shared/types.ts";

export const createClassicPipelineArgs = <
  Args extends {
    networkConfig: OpenChannelsArgs["networkConfig"];
    rpc?: OpenChannelsArgs["rpc"];
  },
>(
  args: Args,
) =>
  args.rpc
    ? { networkConfig: args.networkConfig, rpc: args.rpc }
    : { networkConfig: args.networkConfig };

export const resolveRpc = <
  Args extends {
    networkConfig: OpenChannelsArgs["networkConfig"];
    rpc?: OpenChannelsArgs["rpc"];
  },
>(
  args: Args,
) =>
  args.rpc ??
  new Server(args.networkConfig.rpcUrl!, {
    allowHttp: args.networkConfig.allowHttp ?? false,
  });

export const createChannelAccount = (): ChannelAccount =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

export const sponsorCanSignChannel = async (
  rpc: Server,
  sponsor: ChannelAccount,
  channel: ChannelAccount,
): Promise<boolean> => {
  const accountEntry = await rpc.getAccountEntry(channel.address());

  return accountEntry.signers.some((signer) => {
    try {
      return (
        signer.weight > 0 &&
        signer.key.type === "signerKeyTypeEd25519" &&
        StrKey.encodeEd25519PublicKey(signer.key.ed25519.toBytes()) ===
          sponsor.address()
      );
    } catch {
      return false;
    }
  });
};

type SignableTransactionWithSignatures = SignableTransaction & {
  signatures: xdr.DecoratedSignature[];
  toXdr(format: "base64"): string;
};

export const createChannelProxySigner = (
  signer: KeypairSigner,
  channel: ChannelAccount,
): KeypairSigner => {
  const signerHint = StrKey.decodeEd25519PublicKey(signer.publicKey()).slice(
    -4,
  );

  return {
    publicKey: () => channel.address(),
    signerKey: signer.signerKey.bind(signer),
    sign: signer.sign.bind(signer),
    signTransaction: (transaction) => {
      const signableTransaction = transaction as SignableTransactionWithSignatures;
      const alreadySigned = signableTransaction.signatures.some((signature) =>
        signature.hint.toBytes().every((byte, index) =>
          byte === signerHint[index]
        )
      );

      return alreadySigned
        ? signableTransaction.toXdr("base64")
        : signer.signTransaction(transaction);
    },
    signSorobanAuthEntry: signer.signSorobanAuthEntry.bind(signer),
    signsFor: (target) => target === channel.address(),
  };
};

export const chunkChannels = (
  channels: readonly ChannelAccount[],
  size: number,
): ChannelAccount[][] =>
  Array.from(
    { length: Math.ceil(channels.length / size) },
    (_, index) => channels.slice(index * size, (index + 1) * size),
  );
