import {
  assertRequiredArgs,
  ColibriError,
  createClassicTransactionPipeline,
  LocalSigner,
  NativeAccount,
  type SignableTransaction,
  type Signer,
  StrKey,
} from "@colibri/core";
import { Operation, type xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { appendUniqueSigners } from "@/shared/signers.ts";
import {
  type ChannelAccount,
  type CloseChannelsArgs,
  MAX_CHANNELS_PER_TRANSACTION,
  type OpenChannelsArgs,
} from "@/shared/types.ts";
import * as E from "@/shared/error.ts";

const createClassicPipelineArgs = <
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

const resolveRpc = <
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

const createChannelAccount = (): ChannelAccount =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

const sponsorCanSignChannel = async (
  rpc: Server,
  sponsor: ChannelAccount,
  channel: ChannelAccount,
): Promise<boolean> => {
  const accountEntry = await rpc.getAccountEntry(channel.address());

  return accountEntry.signers().some((signer) => {
    try {
      return (
        signer.weight() > 0 &&
        StrKey.encodeEd25519PublicKey(signer.key().ed25519()) ===
          sponsor.address()
      );
    } catch {
      return false;
    }
  });
};

type SignableTransactionWithSignatures = SignableTransaction & {
  signatures: xdr.DecoratedSignature[];
  toXDR(format: "base64"): string;
};

const createChannelProxySigner = (
  signer: Signer,
  channel: ChannelAccount,
): Signer => {
  const signerHint = StrKey.decodeEd25519PublicKey(signer.publicKey()).slice(-4);

  return {
  publicKey: () => channel.address(),
  sign: (data) => signer.sign(data),
  signTransaction: (transaction) => {
    const signableTransaction = transaction as SignableTransactionWithSignatures;
    const alreadySigned = signableTransaction.signatures.some((signature) =>
      signature.hint().every((byte, index) => byte === signerHint[index])
    );

    return alreadySigned
      ? signableTransaction.toXDR("base64")
      : signer.signTransaction(transaction);
  },
  signSorobanAuthEntry: (authEntry, validUntilLedgerSeq, networkPassphrase) =>
    signer.signSorobanAuthEntry(
      authEntry,
      validUntilLedgerSeq,
      networkPassphrase,
    ),
  signsFor: (target) => target === channel.address(),
  };
};

const chunkChannels = (
  channels: readonly ChannelAccount[],
  size: number,
): ChannelAccount[][] =>
  Array.from(
    { length: Math.ceil(channels.length / size) },
    (_, index) => channels.slice(index * size, (index + 1) * size),
  );

/**
 * Opens and closes sponsored Stellar channel accounts for later pipeline reuse.
 */
export class ChannelAccounts {
  /**
   * Opens and optionally augments a bounded set of channel accounts.
   *
   * @param args - Channel creation arguments
   * @returns The created channel accounts, each paired with its signer
   *
   * @example
   * ```typescript
   * const channels = await ChannelAccounts.open({
   *   numberOfChannels: 2,
   *   sponsor,
   *   networkConfig,
   *   config,
   * });
   * ```
   */
  static async open(args: OpenChannelsArgs): Promise<ChannelAccount[]> {
    const {
      numberOfChannels,
      sponsor,
      setSponsorAsSigner,
      networkConfig,
      config,
      rpc,
    } = args;

    assertRequiredArgs(
      {
        numberOfChannels,
        sponsor,
        networkConfig,
        config,
      },
      (argName: string) => new E.MISSING_ARG(argName),
    );

    if (
      numberOfChannels < 1 ||
      numberOfChannels > MAX_CHANNELS_PER_TRANSACTION
    ) {
      throw new E.INVALID_NUMBER_OF_CHANNELS(
        numberOfChannels,
        1,
        MAX_CHANNELS_PER_TRANSACTION,
      );
    }

    try {
      const channels = Array.from(
        { length: numberOfChannels },
        () => createChannelAccount(),
      );

      const operations = channels.flatMap((channel) => {
        const channelOperations = [
          Operation.beginSponsoringFutureReserves({
            source: sponsor.address(),
            sponsoredId: channel.address(),
          }),
          Operation.createAccount({
            source: sponsor.address(),
            destination: channel.address(),
            startingBalance: "0",
          }),
        ];

        if (setSponsorAsSigner) {
          channelOperations.push(
            Operation.setOptions({
              source: channel.address(),
              signer: {
                ed25519PublicKey: sponsor.address(),
                weight: 1,
              },
            }),
          );
        }

        channelOperations.push(
          Operation.endSponsoringFutureReserves({
            source: channel.address(),
          }),
        );

        return channelOperations;
      });

      const pipeline = createClassicTransactionPipeline(
        createClassicPipelineArgs({ networkConfig, rpc }),
      );

      await pipeline.run({
        operations,
        config: {
          ...config,
          signers: appendUniqueSigners(
            config.signers,
            sponsor.signer(),
            ...channels.map((channel) => channel.signer()),
          ),
        },
      });

      return channels;
    } catch (error) {
      if (error instanceof ColibriError) throw error;
      throw new E.UNEXPECTED_ERROR(error as Error);
    }
  }

  /**
   * Closes channel accounts by merging their balances back into the sponsor.
   *
   * @param args - Channel close arguments
   * @returns Resolves when all requested channels have been merged
   *
   * @example
   * ```typescript
   * await ChannelAccounts.close({
   *   channels,
   *   sponsor,
   *   networkConfig,
   *   config,
   * });
   * ```
   */
  static async close(args: CloseChannelsArgs): Promise<void> {
    const {
      channels,
      sponsor,
      networkConfig,
      config,
      rpc,
    } = args;

    assertRequiredArgs(
      {
        channels,
        sponsor,
        networkConfig,
        config,
      },
      (argName: string) => new E.MISSING_ARG(argName),
    );

    if (channels.length === 0) return;

    try {
      const pipeline = createClassicTransactionPipeline(
        createClassicPipelineArgs({ networkConfig, rpc }),
      );
      const closeRpc = resolveRpc({ networkConfig, rpc });
      const sponsorSigner = sponsor.signer();

      for (const channelBatch of chunkChannels(
        channels,
        MAX_CHANNELS_PER_TRANSACTION,
      )) {
        const closeSigners = await Promise.all(
          channelBatch.map(async (channel) =>
            await sponsorCanSignChannel(closeRpc, sponsor, channel)
              ? createChannelProxySigner(sponsorSigner, channel)
              : channel.signer()
          ),
        );

        await pipeline.run({
          operations: channelBatch.map((channel) =>
            Operation.accountMerge({
              source: channel.address(),
              destination: sponsor.address(),
            })
          ),
          config: {
            ...config,
            signers: appendUniqueSigners(config.signers, ...closeSigners),
          },
        });
      }
    } catch (error) {
      if (error instanceof ColibriError) throw error;
      throw new E.UNEXPECTED_ERROR(error as Error);
    }
  }
}
