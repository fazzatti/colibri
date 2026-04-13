import {
  assertArrayIncludes,
  assertEquals,
  assertExists,
  assertRejects,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { pipe, step } from "convee";
import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  type ClassicTransactionInput,
  type ClassicTransactionOutput,
  INVOKE_CONTRACT_PIPELINE_ID,
  type InvokeContractInput,
  type InvokeContractOutput,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import {
  CHANNEL_ACCOUNTS_PLUGIN_ID,
  CHANNEL_ACCOUNTS_PLUGIN_TARGETS,
  ChannelAccounts,
  createChannelAccountsPlugin,
  INVALID_NUMBER_OF_CHANNELS,
} from "@/index.ts";

describe("ChannelAccounts", () => {
  const networkConfig = NetworkConfig.TestNet();
  const sponsor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const actor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const channel = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

  const txConfig: TransactionConfig = {
    fee: "100",
    timeout: 30,
    source: actor.address(),
    signers: [actor.signer()],
  };

  const createPipelineInput = <
    Input extends ClassicTransactionInput | InvokeContractInput,
  >(): Input =>
    ({
      operations: [],
      config: txConfig,
    }) as unknown as Input;

  const createClassicPipelineOutput = (): ClassicTransactionOutput => ({
    hash: "classic-hash",
    response: {} as ClassicTransactionOutput["response"],
  });

  const createInvokePipelineOutput = (): InvokeContractOutput => ({
    hash: "invoke-hash",
    ledger: 12345,
    createdAt: Date.now(),
    response: {} as InvokeContractOutput["response"],
    returnValue: undefined,
  });

  describe("Handler validation", () => {
    it("rejects invalid channel counts before running the network flow", async () => {
      await assertRejects(
        async () =>
          await ChannelAccounts.open({
            numberOfChannels: 0,
            sponsor,
            networkConfig,
            config: {
              ...txConfig,
              source: sponsor.address(),
              signers: [sponsor.signer()],
            },
          }),
        INVALID_NUMBER_OF_CHANNELS,
      );
    });
  });

  describe("Shared plugin", () => {
    it("initializes with the expected id and supported targets", () => {
      const plugin = createChannelAccountsPlugin({
        channels: [channel],
      });

      assertExists(plugin);
      assertEquals(plugin.id, CHANNEL_ACCOUNTS_PLUGIN_ID);
      assertEquals(plugin.target, undefined);
      assertEquals(plugin.targets(CLASSIC_TRANSACTION_PIPELINE_ID), true);
      assertEquals(plugin.targets(INVOKE_CONTRACT_PIPELINE_ID), true);
      assertEquals(plugin.targets("SomeOtherPipeline"), false);
      assertEquals(CHANNEL_ACCOUNTS_PLUGIN_TARGETS, [
        CLASSIC_TRANSACTION_PIPELINE_ID,
        INVOKE_CONTRACT_PIPELINE_ID,
      ]);
      assertEquals(
        plugin.getChannels().map((item) => item.address()),
        [channel.address()],
      );
    });

    it("registers channels after construction and exposes proxy members", () => {
      const extraChannel = NativeAccount.fromMasterSigner(
        LocalSigner.generateRandom(),
      );
      const plugin = createChannelAccountsPlugin();

      plugin.registerChannels([channel, extraChannel]);

      assertEquals("targets" in plugin, true);
      assertEquals("getChannels" in plugin, true);
      assertEquals("id" in plugin, true);
      assertEquals(
        plugin
          .getChannels()
          .map((item) => item.address())
          .sort(),
        [channel.address(), extraChannel.address()].sort(),
      );
    });

    it("injects a channel account and releases it after classic success", async () => {
      const plugin = createChannelAccountsPlugin({
        channels: [channel],
      });

      const pipeline = pipe(
        [
          step(
            (input: ClassicTransactionInput): ClassicTransactionOutput => {
              assertEquals(input.config.source, channel.address());
              assertArrayIncludes(
                input.config.signers.map((signer) => signer.publicKey()),
                [actor.address(), channel.address()],
              );

              return createClassicPipelineOutput();
            },
            {
              id: "classic-pass-through" as const,
            },
          ),
        ] as const,
        { id: CLASSIC_TRANSACTION_PIPELINE_ID },
      );

      pipeline.use(plugin);

      const result = await pipeline.run(
        createPipelineInput<ClassicTransactionInput>(),
      );

      assertEquals(result.hash, "classic-hash");
      assertEquals(
        plugin.getChannels().map((item) => item.address()),
        [channel.address()],
      );
    });

    it("ignores output release when no channel is allocated", () => {
      const plugin = createChannelAccountsPlugin({
        channels: [channel],
      });
      const output = createClassicPipelineOutput();
      const outputHook = (
        plugin as {
          output(
            this: unknown,
            output: ClassicTransactionOutput,
          ): ClassicTransactionOutput;
        }
      ).output;

      const result = outputHook.call(
        {
          context: () => ({ runId: "missing-run" }),
        } as never,
        output,
      );

      assertEquals(result, output);
    });
  });

  describe("InvokeContract usage", () => {
    it("releases its channel back to the pool when the pipeline fails", async () => {
      const plugin = createChannelAccountsPlugin({
        channels: [channel],
      });

      const failingPipeline = pipe(
        [
          step(
            (input: InvokeContractInput): InvokeContractOutput => {
              assertEquals(input.config.source, channel.address());
              assertArrayIncludes(
                input.config.signers.map((signer) => signer.publicKey()),
                [actor.address(), channel.address()],
              );

              throw new Error("boom");
            },
            { id: "invoke-failure" as const },
          ),
        ] as const,
        { id: INVOKE_CONTRACT_PIPELINE_ID },
      );

      failingPipeline.use(plugin);

      await assertRejects(
        async () =>
          await failingPipeline.run(createPipelineInput<InvokeContractInput>()),
        Error,
        "boom",
      );

      assertEquals(
        plugin.getChannels().map((item) => item.address()),
        [channel.address()],
      );

      const recoveryPipeline = pipe(
        [
          step(
            (input: InvokeContractInput): InvokeContractOutput => {
              assertEquals(input.config.source, channel.address());
              assertArrayIncludes(
                input.config.signers.map((signer) => signer.publicKey()),
                [actor.address(), channel.address()],
              );

              return createInvokePipelineOutput();
            },
            {
              id: "invoke-pass-through" as const,
            },
          ),
        ] as const,
        { id: INVOKE_CONTRACT_PIPELINE_ID },
      );

      recoveryPipeline.use(plugin);

      const result = await recoveryPipeline.run(
        createPipelineInput<InvokeContractInput>(),
      );

      assertEquals(result.hash, "invoke-hash");
      assertEquals(
        plugin.getChannels().map((item) => item.address()),
        [channel.address()],
      );
    });

    it("accepts an explicit pipeline target", () => {
      const plugin = createChannelAccountsPlugin({
        channels: [channel],
        target: CLASSIC_TRANSACTION_PIPELINE_ID,
      });

      assertEquals(plugin.target, CLASSIC_TRANSACTION_PIPELINE_ID);
      assertEquals(plugin.targets(CLASSIC_TRANSACTION_PIPELINE_ID), true);
      assertEquals(plugin.targets(INVOKE_CONTRACT_PIPELINE_ID), false);
    });
  });
});
