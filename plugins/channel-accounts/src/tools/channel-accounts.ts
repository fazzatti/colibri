import {
  assertRequiredArgs,
  ColibriError,
  createClassicTransactionPipeline,
  LocalSigner,
  NativeAccount,
  type Signer,
  StrKey,
} from "@colibri/core";
import { Operation, TransactionBuilder, type Transaction } from "stellar-sdk";
import { Api, Server } from "stellar-sdk/rpc";
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

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const signTransactionWithSigners = async (
  transaction: Transaction,
  signers: readonly Signer[],
  networkPassphrase: string,
): Promise<Transaction> => {
  let signedTransaction = transaction;

  for (const signer of signers) {
    signedTransaction = TransactionBuilder.fromXDR(
      await signer.signTransaction(signedTransaction),
      networkPassphrase,
    ) as Transaction;
  }

  return signedTransaction;
};

const submitTransaction = async (
  rpc: Server,
  transaction: Transaction,
  timeoutInSeconds: number,
): Promise<void> => {
  const sendResponse = await rpc.sendTransaction(transaction);

  if (sendResponse.status === "ERROR") {
    throw new Error(
      `Transaction processing error: ${sendResponse.errorResult ?? "unknown"}`,
    );
  }

  if (sendResponse.status === "DUPLICATE") {
    throw new Error(`Duplicate transaction: ${sendResponse.hash}`);
  }

  if (sendResponse.status === "TRY_AGAIN_LATER") {
    throw new Error(`Transaction throttled: ${sendResponse.hash}`);
  }

  if (sendResponse.status !== "PENDING") {
    throw new Error(`Unexpected transaction status: ${sendResponse.status}`);
  }

  const deadline = Date.now() + timeoutInSeconds * 1000;

  while (Date.now() < deadline) {
    const response = await rpc.getTransaction(sendResponse.hash);

    if (response.status === Api.GetTransactionStatus.SUCCESS) {
      return;
    }

    if (response.status === Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${sendResponse.hash}`);
    }

    await delay(500);
  }

  throw new Error(`Transaction timed out: ${sendResponse.hash}`);
};

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
      const closeRpc = resolveRpc({ networkConfig, rpc });

      for (const channel of channels) {
        const signers = await sponsorCanSignChannel(closeRpc, sponsor, channel)
          ? appendUniqueSigners(config.signers, sponsor.signer())
          : appendUniqueSigners(config.signers, channel.signer());
        const sourceAccount = await closeRpc.getAccount(config.source);
        const transaction = new TransactionBuilder(sourceAccount, {
          fee: config.fee,
          networkPassphrase: networkConfig.networkPassphrase,
        })
          .addOperation(
            Operation.accountMerge({
              source: channel.address(),
              destination: sponsor.address(),
            }),
          )
          .setTimeout(config.timeout)
          .build();

        const signedTransaction = await signTransactionWithSigners(
          transaction,
          signers,
          networkConfig.networkPassphrase,
        );

        await submitTransaction(closeRpc, signedTransaction, config.timeout);
      }
    } catch (error) {
      if (error instanceof ColibriError) throw error;
      throw new E.UNEXPECTED_ERROR(error as Error);
    }
  }
}
