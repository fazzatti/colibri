import {
  createChannelAccountsPlugin,
  createChannelAccountsWorker,
} from "@colibri/plugin-channel-accounts";
import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  type ClassicTransactionInput,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  steps,
} from "@colibri/core";
import { Keypair, Operation } from "stellar-sdk";
import { pipe, step } from "convee";
import { worker } from "convee/workers";

export const channelAddresses = [1, 2].map((byte) =>
  Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(byte)).publicKey()
);
export default createChannelAccountsWorker((address) => {
  const key = [1, 2].map((byte) =>
    Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(byte))
  ).find((key) => key.publicKey() === address)!;
  const channel = NativeAccount.fromMasterSigner(
    LocalSigner.fromSecret(key.secret() as `S${string}`),
  );
  let executions = 0;
  const build = pipe([
    step((input: ClassicTransactionInput) => ({
      source: input.config.source,
      sequence: "100",
      baseFee: "100" as const,
      networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      operations: input.operations,
    })),
    steps.createBuildTransactionStep(),
  ], { id: CLASSIC_TRANSACTION_PIPELINE_ID });
  build.use(createChannelAccountsPlugin({ channels: [channel] }));
  return {
    channel,
    async run(request: { fail?: boolean }) {
      executions++;
      if (request.fail) throw new Error("uncertain consumer result");
      const transaction = await build({
        operations: [Operation.setOptions({ homeDomain: "example.org" })],
        config: {
          source: channel.address(),
          signers: [channel.signer()],
          fee: "100",
          timeout: 30,
        },
      });
      return { address, source: transaction.source, executions };
    },
  };
}, (run) => worker(run, { module: import.meta.url }));
