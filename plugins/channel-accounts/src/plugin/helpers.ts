import type { TransactionConfig } from "@colibri/core";
import type {
  ChannelAccount,
  ChannelAccountsPipelineInput,
} from "@/shared/types.ts";
import { appendUniqueSigners } from "@/shared/signers.ts";

export const injectChannelAccount = <
  Input extends ChannelAccountsPipelineInput,
>(
  input: Input,
  channel: ChannelAccount,
): Input => {
  const nextConfig: TransactionConfig = {
    ...input.config,
    source: channel.address(),
    signers: appendUniqueSigners(input.config.signers, channel.signer()),
  };

  return {
    ...input,
    config: nextConfig,
  };
};
