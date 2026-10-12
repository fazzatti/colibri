import { concurrent } from "convee";
import type { KeypairSigner } from "@colibri/core";
import type { Server } from "stellar-sdk/rpc";
import type { ChannelAccount } from "@/shared/types.ts";
import {
  createChannelProxySigner,
  sponsorCanSignChannel,
} from "@/tools/helpers.ts";

/** Resolve a batch locally, retaining signer identity and the first-error timing. */
export const resolveCloseSigners = async (
  rpc: Server,
  sponsor: ChannelAccount,
  sponsorSigner: KeypairSigner,
  channels: readonly ChannelAccount[],
  concurrency: number,
): Promise<KeypairSigner[]> => {
  const failure = Promise.withResolvers<never>();
  const resolve = concurrent({
    concurrency,
    tasks: {
      signer: async (channel: ChannelAccount): Promise<KeypairSigner> => {
        try {
          return await sponsorCanSignChannel(rpc, sponsor, channel)
            ? createChannelProxySigner(sponsorSigner, channel)
            : channel.signer();
        } catch (error) {
          failure.reject(error);
          throw error;
        }
      },
    },
    mode: "collect",
    split: ({ signer }) => channels.map((channel) => signer.job(channel)),
    join: (outcomes): KeypairSigner[] =>
      outcomes.map((outcome) => {
        if (outcome.status === "rejected") throw outcome.error;
        return outcome.value;
      }),
  });
  // Like Promise.all, failure is reported immediately while already scheduled
  // read-only work settles. The race observes the scheduler's eventual outcome.
  return await Promise.race([failure.promise, resolve()]);
};
