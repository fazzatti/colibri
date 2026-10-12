import { createChannelAccountsParallel } from "@colibri/plugin-channel-accounts";
import { Keypair } from "stellar-sdk";

/** Exercise the same real-worker contract in server and browser consumers. */
export async function checkChannelWorkers(
  definition: typeof import("./channel-worker.ts")["default"],
): Promise<void> {
  const addresses = [1, 2].map((byte) =>
    Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(byte)).publicKey()
  );
  const owner = createChannelAccountsParallel({
    channels: addresses,
    worker: definition,
  });
  try {
    await owner.ready();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => owner.step({})),
    );
    if (new Set(results.map((result) => result.address)).size !== 2) {
      throw new Error("CHANNEL_WORKERS: both accounts must execute");
    }
    for (const address of addresses) {
      const own = results.filter((result) => result.address === address);
      if (
        own.some((result, index) =>
          result.source !== address || result.executions !== index + 1
        )
      ) {
        throw new Error(
          "CHANNEL_WORKERS: account binding or persistent state failed",
        );
      }
    }
    const failure = await owner.step({ fail: true }).then(
      () => undefined,
      (error) => error,
    );
    if (
      !failure ||
      owner.getChannels().filter((channel) => channel.state === "quarantined")
          .length !== 1
    ) {
      throw new Error(
        "CHANNEL_WORKERS: uncertainty must quarantine one account",
      );
    }
    const healthy = await owner.step({});
    if (
      owner.getChannels().find((channel) => channel.address === healthy.address)
        ?.state !== "available"
    ) {
      throw new Error(
        "CHANNEL_WORKERS: healthy channel should remain available",
      );
    }
  } finally {
    await owner.close();
  }
  const closed = await owner.step({}).then(() => false, () => true);
  if (!closed) throw new Error("CHANNEL_WORKERS: close must be terminal");
  console.log(
    "Channel worker consumer passed with real worker transports and offline Colibri pipelines",
  );
}

/** Compile-time negative cases; deliberately never executed. */
export async function invalidWorkerInputs(
  definition: typeof import("./channel-worker.ts")["default"],
): Promise<void> {
  // Compile-only invalid consumers also run through actual installed declaration
  // checks. No invalid request reaches a worker.
  const owner = createChannelAccountsParallel({
    channels: [],
    worker: definition,
  });
  // @ts-expect-error Request fields follow the imported worker definition.
  await owner.step({ fail: "yes" });
  // @ts-expect-error The worker accepts exactly one request argument.
  await owner.step({}, {});
  // @ts-expect-error runWith preserves the worker request type.
  await owner.step.runWith({}, { fail: 1 });
  const receipt = await owner.step({});
  // @ts-expect-error Worker results retain their inferred numeric fields.
  const count: string = receipt.executions;
  // @ts-expect-error Result inference must not widen to any.
  receipt.missing;
  void count;
}

// Deno consumes source; Node/Bun consume tsc-emitted ESM. Browser builds call
// checkChannelWorkers with their statically imported Vite-transformed definition.
const deno = Reflect.get(globalThis, "Deno") !== undefined;
const node = Reflect.get(globalThis, "process")?.versions?.node;
if (deno || node) {
  const path = new URL(
    `./channel-worker.${deno ? "ts" : "js"}`,
    import.meta.url,
  );
  const { default: definition } = await import(
    path.href
  ) as typeof import("./channel-worker.ts");
  await checkChannelWorkers(definition);
}
