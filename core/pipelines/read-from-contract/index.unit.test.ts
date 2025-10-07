import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { type NetworkConfig, NetworkType } from "../../network/index.ts";
import * as E from "./error.ts";
import { createReadFromContractPipeline } from "./index.ts";

describe("createReadFromContractPipeline", () => {
  describe("Construction", () => {
    it("creates pipeline with proper name when valid config is provided", () => {
      const networkConfig: NetworkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
        type: NetworkType.TESTNET,
      };

      const pipeline = createReadFromContractPipeline({ networkConfig });

      assertEquals(pipeline.name, "ReadFromContractPipeline");
    });
  });

  describe("Errors", () => {
    it("throws MISSING_ARG when networkConfig is missing", () => {
      assertThrows(
        () =>
          createReadFromContractPipeline({
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
        () => createReadFromContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when rpcUrl is missing", () => {
      const networkConfig = {
        networkPassphrase: "Test SDF Network ; September 2015",
      } as NetworkConfig;

      assertThrows(
        () => createReadFromContractPipeline({ networkConfig }),
        E.MISSING_ARG
      );
    });

    it("throws MISSING_ARG when both networkPassphrase and rpcUrl are missing", () => {
      const networkConfig = {} as NetworkConfig;

      assertThrows(
        () => createReadFromContractPipeline({ networkConfig }),
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
        () => createReadFromContractPipeline({ networkConfig }),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
