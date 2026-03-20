import {
  assertInstanceOf,
  assertStrictEquals,
  assertExists,
  assertRejects,
  assertEquals,
} from "@std/assert";

import { describe, it, afterAll } from "@std/testing/bdd";
import { resolveDockerOptions } from "@/quickstart/docker.ts";
import { Code, INVALID_CONFIGURATION } from "@/quickstart/error.ts";
import type { LogLevelDesc } from "@/quickstart/logging.ts";
import { StellarTestLedger } from "@/quickstart/index.ts";
import { findContainerByName } from "@/quickstart/runtime.ts";
import type { SupportedImageVersions } from "@/quickstart/types.ts";
import type { Container } from "dockerode";

describe("StellarTestLedger", () => {
  const logLevel: LogLevelDesc = "silent";
  const stellarTestLedger = new StellarTestLedger({ logLevel });

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
          containerImageVersion: "nope" as unknown as SupportedImageVersions,
        });
      }).then((error) => {
        assertInstanceOf(error, INVALID_CONFIGURATION);
        assertStrictEquals(error.code, Code.INVALID_CONFIGURATION);
      });
    });
  });

  describe("Features", () => {
    it("discovers Docker automatically when no client is injected", async () => {
      const previousDockerHost = Deno.env.get("DOCKER_HOST");
      Deno.env.delete("DOCKER_HOST");

      try {
        const dockerOptions = resolveDockerOptions();
        assertExists(dockerOptions.socketPath);

        const missingContainer = await findContainerByName(
          `missing-${crypto.randomUUID()}`
        );
        assertEquals(missingContainer, undefined);
      } finally {
        if (previousDockerHost) {
          Deno.env.set("DOCKER_HOST", previousDockerHost);
        } else {
          Deno.env.delete("DOCKER_HOST");
        }
      }
    });

    it("starts/stops/destroys a valid docker container", async () => {
      const container: Container = await stellarTestLedger.start();
      assertExists(container);

      const networkConfig = await stellarTestLedger.getNetworkConfiguration();
      assertExists(networkConfig);
      assertExists(networkConfig.horizonUrl);
      assertExists(networkConfig.networkPassphrase);
      assertExists(networkConfig.rpcUrl);
      assertExists(networkConfig.friendbotUrl);

      const horizonResponse = await fetch(networkConfig.horizonUrl as string);
      assertExists(horizonResponse);
      assertStrictEquals(horizonResponse.status, 200);
      await horizonResponse.text();
    });
  });
});
