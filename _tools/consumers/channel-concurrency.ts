import { createChannelAccountsConcurrent } from "@colibri/plugin-channel-accounts";
import {
  type ClassicTransactionInput,
  LocalSigner,
  NativeAccount,
} from "@colibri/core";

const channel = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const actor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
let active = 0;
let peak = 0;
const original = { result: () => "live result" };
const execute = createChannelAccountsConcurrent({
  channels: [channel, channel],
  run: async (input: ClassicTransactionInput) => {
    if (
      input.config.source !== channel.address() ||
      input.config.signers[0] !== actor.signer() ||
      input.config.signers[1] !== channel.signer()
    ) {
      throw new Error(
        "CHANNEL_LOCAL_IDENTITY: source/signers changed unexpectedly",
      );
    }
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 0));
    active--;
    return original;
  },
});
const input: ClassicTransactionInput = {
  operations: [],
  config: {
    source: actor.address(),
    signers: [actor.signer()],
    fee: "100",
    timeout: 30,
  },
};
const results = await Promise.all([
  execute(input),
  execute(input),
  execute(input),
]);
if (
  peak !== 1 || results.some((value) => value !== original) ||
  input.config.source !== actor.address()
) {
  throw new Error(
    "CHANNEL_LOCAL_SCHEDULING: duplicate channels, result identity or input mutation failed",
  );
}
console.log("Channel concurrency consumer passed");
