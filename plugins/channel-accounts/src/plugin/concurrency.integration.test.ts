import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  type ClassicTransactionInput,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  steps,
} from "@colibri/core";
import { pipe, step } from "convee";
import { Operation } from "stellar-sdk";
import { createChannelAccountsPlugin } from "@/plugin/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("Local channel pipeline execution", () => {
  it("executes the real transaction builder with channel sources and original operation sources", async () => {
    const actor = LocalSigner.generateRandom();
    const channels = Array.from(
      { length: 2 },
      () => NativeAccount.fromMasterSigner(LocalSigner.generateRandom()),
    );
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
    build.use(createChannelAccountsPlugin({ channels }));
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      build({
        operations: [
          Operation.setOptions({
            source: actor.publicKey(),
            homeDomain: "example.org",
          }),
        ],
        config: {
          source: actor.publicKey(),
          signers: [actor],
          fee: "100",
          timeout: 30,
        },
      })));
    assertEquals(
      new Set(results.map((transaction) => transaction.source)).size,
      2,
    );
    for (const transaction of results) {
      assertEquals(transaction.operations[0].source, actor.publicKey());
      assertEquals(transaction.fee, "100");
    }
  });
});
