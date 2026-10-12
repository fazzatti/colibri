import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  type ClassicTransactionInput,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  steps,
} from "@colibri/core";
import {
  createChannelAccountsPlugin,
  createChannelAccountsWorker,
} from "@colibri/plugin-channel-accounts";
import { Keypair, Operation } from "stellar-sdk";
import { pipe, plugin, step } from "convee";

export interface Request {
  delayMs?: number;
  fail?: boolean;
  crash?: boolean;
  uncloneable?: boolean;
  hang?: boolean;
  phase?: SharedArrayBuffer;
  gate?: SharedArrayBuffer;
  finalizerGate?: SharedArrayBuffer;
}
export interface Receipt {
  address: string;
  source: string;
  executions: number;
}
export const addresses = [1, 2].map((byte) =>
  Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(byte)).publicKey()
);
const waitGate = async (gate: SharedArrayBuffer | undefined) => {
  while (gate && Atomics.load(new Int32Array(gate), 0) === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

export default createChannelAccountsWorker((address: string) => {
  const key = [1, 2].map((byte) =>
    Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(byte))
  ).find((key) => key.publicKey() === address)!;
  const signer = LocalSigner.fromSecret(key.secret() as `S${string}`);
  const channel = NativeAccount.fromMasterSigner(signer);
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
  build.use(
    plugin({ id: "worker-cleanup" }).onFinally(async function () {
      const phase = this.context().state.get("phase") as
        | SharedArrayBuffer
        | undefined;
      if (phase) Atomics.store(new Int32Array(phase), 0, 2);
      await waitGate(
        this.context().state.get("gate") as SharedArrayBuffer | undefined,
      );
    }),
  );
  return {
    channel,
    async run(input: Request): Promise<Receipt> {
      executions++;
      if (input.phase) Atomics.store(new Int32Array(input.phase), 0, 1);
      if (input.hang) await new Promise(() => {});
      if (input.crash) {
        return new Promise(() => {
          queueMicrotask(() => {
            throw new Error("intentional worker crash");
          });
        });
      }
      await waitGate(input.gate);
      if (input.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, input.delayMs));
      }
      if (input.fail) throw new Error("uncertain operation");
      if (input.uncloneable) return { invalid: build } as unknown as Receipt;
      const tx = await build.runWith({
        context: { seed: { phase: input.phase, gate: input.finalizerGate } },
      }, {
        operations: [Operation.setOptions({ homeDomain: "example.org" })],
        config: {
          source: channel.address(),
          signers: [signer],
          fee: "100",
          timeout: 30,
        },
      });
      return { address, source: tx.source, executions };
    },
  };
}, { module: import.meta.url });
