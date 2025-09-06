import { assertStrictEquals, assertExists, assertRejects } from "@std/assert";

import { describe, it, afterAll } from "@std/testing/bdd";
import type { LogLevelDesc } from "../logger/types.ts";
import { StellarTestLedger } from "./index.ts";
import type { SupportedImageVersions } from "./types.ts";
import type { Container } from "dockerode";

describe("StellarTestLEdger", () => {
  const logLevel: LogLevelDesc = "debug";
  const stellarTestLedger = new StellarTestLedger({ logLevel });

  afterAll(async () => {
    await stellarTestLedger.stop();
    await stellarTestLedger.destroy();
  });

  describe("Constructor", () => {
    it("initializes with minimal input", () => {
      assertExists(StellarTestLedger);
      assertExists(() => {
        return new StellarTestLedger();
      });
    });
    it("throws if invalid input is provided", () => {
      assertExists(StellarTestLedger);

      assertRejects(async () => {
        return await new StellarTestLedger({
          containerImageVersion: "nope" as unknown as SupportedImageVersions,
        });
      });
    });
  });

  describe("Features", () => {
    it("starts/stops/destroys a valid docker container", async () => {
      console.log("Starting container...");
      try {
        const container: Container = await stellarTestLedger.start();
        console.log("Container started");
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
      } catch (error) {
        console.error("Failed to start container:", error);
        throw error;
      }
    });
  });
});
