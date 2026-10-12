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
// These deliberately invalid consumers are checked against both source and
// installed declarations, but never executed as runtime requests.
export async function invalidLocalInputs(): Promise<void> {
  // @ts-expect-error The original pipeline input remains required.
  await execute({});
  // @ts-expect-error The wrapper preserves a single-input pipeline contract.
  await execute(input, input);
  // @ts-expect-error runWith has the same input contract as the callable facade.
  await execute.runWith({}, 1);
  const value = await execute(input);
  // @ts-expect-error The result method remains callable, not a string property.
  const text: string = value.result;
  // @ts-expect-error Result inference must not widen to any.
  value.missing;
  void text;
}
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
