import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { type NetworkConfig, NetworkType } from "../../network/index.ts";
import * as E from "./error.ts";
import { createClassicTransactionPipeline } from "./index.ts";

describe("createClassicTransactionPipeline", () => {
  describe("Construction", () => {
    it("creates pipeline with proper name when valid config is provided", () => {
      const networkConfig: NetworkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        type: NetworkType.TESTNET,
      };

      const pipeline = createClassicTransactionPipeline({ networkConfig });

      assertEquals(pipeline.name, "ClassicTransactionPipeline");
    });
  });

  describe("Connectors", () => {});
  describe("Errors", () => {
    it("throws MISSING_ARG when networkConfig is missing", () => {
      assertThrows(
        () =>
          createClassicTransactionPipeline({
            networkConfig: undefined as unknown as NetworkConfig,
          }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when networkPassphrase is missing", () => {
      const networkConfig = {
        rpcUrl: "https://soroban-testnet.stellar.org",
      } as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when rpcUrl is missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when both networkPassphrase and rpcUrl are missing", () => {
      const networkConfig = {} as NetworkConfig;

      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws UNEXPECTED_ERROR when an unknown error occurs", () => {
      const networkConfig: NetworkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "a", // invalid URL to trigger error
        type: NetworkType.TESTNET,
      };
      assertThrows(
        () => createClassicTransactionPipeline({ networkConfig }),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
