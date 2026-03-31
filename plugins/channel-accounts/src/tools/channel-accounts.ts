import {
  assertRequiredArgs,
  ColibriError,
  createClassicTransactionPipeline,
  LocalSigner,
  NativeAccount,
} from "@colibri/core";
import { Operation } from "stellar-sdk";
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

const createChannelAccount = (): ChannelAccount =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

const DEFAULT_CHANNEL_STARTING_BALANCE = "10";

/**
 * Opens and closes sponsored Stellar channel accounts for later pipeline reuse.
 */
export class ChannelAccounts {
  /**
   * Opens, funds, and optionally augments a bounded set of channel accounts.
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
            startingBalance: DEFAULT_CHANNEL_STARTING_BALANCE,
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

      for (const channel of channels) {
        await pipeline.run({
          operations: [
            Operation.accountMerge({
              source: channel.address(),
              destination: sponsor.address(),
            }),
          ],
          config: {
            ...config,
            source: channel.address(),
            signers: appendUniqueSigners(config.signers, channel.signer()),
          },
        });
      }
    } catch (error) {
      if (error instanceof ColibriError) throw error;
      throw new E.UNEXPECTED_ERROR(error as Error);
    }
  }
}
