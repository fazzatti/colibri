import {
  assertRequiredArgs,
  ColibriError,
  createClassicTransactionPipeline,
} from "@colibri/core";
import { Operation } from "stellar-sdk";
import { appendUniqueSigners } from "@/shared/signers.ts";
import {
  type ChannelAccount,
  type CloseChannelsArgs,
  MAX_CHANNELS_PER_TRANSACTION,
  type OpenChannelsArgs,
} from "@/shared/types.ts";
import {
  chunkChannels,
  createChannelAccount,
  createClassicPipelineArgs,
  resolveRpc,
} from "@/tools/helpers.ts";
import * as ERROR from "@/shared/error.ts";
import { resolveCloseSigners } from "@/tools/close-signers.ts";

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
      (argName: string) => new ERROR.MISSING_ARG(argName),
    );

    if (
      numberOfChannels < 1 ||
      numberOfChannels > MAX_CHANNELS_PER_TRANSACTION
    ) {
      throw new ERROR.INVALID_NUMBER_OF_CHANNELS(
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
      throw new ERROR.UNEXPECTED_ERROR(error as Error);
    }
  }

  /**
   * Closes channel accounts by merging their balances back into the sponsor.
   * Signer discovery is bounded by args.concurrency (default 15); merge batches
   * remain sequential. Stop all pipeline/worker use before merging the accounts.
   *
   * @param args - Accounts, sponsor, network, transaction config, optional RPC and lookup limit.
   * @returns Resolves after every merge batch; an empty account list performs no RPC work.
   * @throws MISSING_ARG for required inputs or INVALID_CONCURRENCY for a limit
   * that is not a positive safe integer. Existing Colibri errors propagate;
   * other failures are wrapped as UNEXPECTED_ERROR with their original cause.
   * Failure stops later merge batches; already scheduled read-only lookups settle.
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
      concurrency = MAX_CHANNELS_PER_TRANSACTION,
    } = args;

    assertRequiredArgs(
      {
        channels,
        sponsor,
        networkConfig,
        config,
      },
      (argName: string) => new ERROR.MISSING_ARG(argName),
    );

    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new ERROR.INVALID_CONCURRENCY(concurrency);
    }
    if (channels.length === 0) return;

    try {
      const pipeline = createClassicTransactionPipeline(
        createClassicPipelineArgs({ networkConfig, rpc }),
      );
      const closeRpc = resolveRpc({ networkConfig, rpc });
      const sponsorSigner = sponsor.signer();

      for (
        const channelBatch of chunkChannels(
          channels,
          MAX_CHANNELS_PER_TRANSACTION,
        )
      ) {
        const closeSigners = await resolveCloseSigners(
          closeRpc,
          sponsor,
          sponsorSigner,
          channelBatch,
          concurrency,
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
      throw new ERROR.UNEXPECTED_ERROR(error as Error);
    }
  }
}
