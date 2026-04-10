import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";

import { afterAll, describe, it } from "@std/testing/bdd";
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
} from "@colibri/core";
import { resolveDockerOptions } from "@/quickstart/docker.ts";
import { Code, INVALID_CONFIGURATION } from "@/quickstart/error.ts";
import type { LogLevelDesc } from "@/quickstart/logging.ts";
import { StellarTestLedger } from "@/quickstart/index.ts";
import { findContainerByName } from "@/quickstart/runtime.ts";
import type { Container } from "dockerode";
import { Asset, Operation } from "stellar-sdk";

describe("StellarTestLedger", () => {
  const logLevel: LogLevelDesc = "silent";
  const stellarTestLedger = new StellarTestLedger({
    logLevel,
    containerName: "colibri-stellar-test-ledger-stable",
    containerImageVersion: "latest",
  });

  afterAll(async () => {
    await stellarTestLedger.stop();
    await stellarTestLedger.destroy();
  });

  describe("Constructor", () => {
    it("initializes with minimal input", () => {
      assertExists(StellarTestLedger);
      const ledger = new StellarTestLedger();
      assertExists(ledger);
      assertStrictEquals(ledger.containerName, "colibri-stellar-test-ledger");
    });

    it("accepts a custom container name", () => {
      const ledger = new StellarTestLedger({
        containerName: "custom-ledger-name",
      });

      assertStrictEquals(ledger.containerName, "custom-ledger-name");
    });
    it("throws if invalid input is provided", () => {
      assertExists(StellarTestLedger);

      return assertRejects(async () => {
        return await new StellarTestLedger({
          containerImageVersion: "",
        });
      }).then((error) => {
        assertInstanceOf(error, INVALID_CONFIGURATION);
        assertStrictEquals(error.code, Code.INVALID_CONFIGURATION);
      });
    });
  });

  describe("Features", () => {
    it("discovers Docker automatically when no client is injected", async () => {
      const dockerOptions = resolveDockerOptions(undefined, {
        dockerHost: undefined,
      });
      assertExists(dockerOptions.socketPath);

      const missingContainer = await findContainerByName(
        `missing-${crypto.randomUUID()}`,
        { dockerOptions },
      );
      assertEquals(missingContainer, undefined);
    });

    it("starts/stops/destroys a valid docker container", async () => {
      const container: Container = await stellarTestLedger.start();
      assertExists(container);

      const networkDetails = await stellarTestLedger.getNetworkDetails();
      assertExists(networkDetails);
      assertExists(networkDetails.horizonUrl);
      assertExists(networkDetails.networkPassphrase);
      assertExists(networkDetails.rpcUrl);
      assertExists(networkDetails.friendbotUrl);

      const horizonResponse = await fetch(networkDetails.horizonUrl as string);
      assertExists(horizonResponse);
      assertStrictEquals(horizonResponse.status, 200);
      await horizonResponse.text();
    });

    it("returns an arbitrary-tag network config that is immediately usable for Friendbot and classic transactions", async () => {
      const latestLedger = new StellarTestLedger({
        containerName: "colibri-stellar-test-ledger-arbitrary-tag",
        containerImageVersion: "v425-latest",
        logLevel,
      });
      const sender = NativeAccount.fromMasterSigner(
        LocalSigner.generateRandom(),
      );
      const recipient = NativeAccount.fromMasterSigner(
        LocalSigner.generateRandom(),
      );

      try {
        await latestLedger.start();

        const networkDetails = await latestLedger.getNetworkDetails();
        assertStrictEquals(networkDetails.allowHttp, true);
        const networkConfig = NetworkConfig.CustomNet(networkDetails);

        await initializeWithFriendbot(
          networkConfig.friendbotUrl!,
          sender.address(),
          {
            rpcUrl: networkConfig.rpcUrl!,
            allowHttp: networkConfig.allowHttp,
          },
        );
        await initializeWithFriendbot(
          networkConfig.friendbotUrl!,
          recipient.address(),
          {
            rpcUrl: networkConfig.rpcUrl!,
            allowHttp: networkConfig.allowHttp,
          },
        );

        const pipeline = createClassicTransactionPipeline({ networkConfig });
        const result = await pipeline.run({
          operations: [
            Operation.payment({
              source: sender.address(),
              destination: recipient.address(),
              asset: Asset.native(),
              amount: "1",
            }),
          ],
          config: {
            fee: "10000000",
            timeout: 30,
            source: sender.address(),
            signers: [sender.signer()],
          },
        });

        assertExists(result);
        assertExists(result.hash);
        assertExists(result.response);
      } finally {
        await latestLedger.stop();
        await latestLedger.destroy();
      }
    });
  });
});
