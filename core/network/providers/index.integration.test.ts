import { type Api, Server } from "stellar-sdk/rpc";
import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { Gateway } from "@/network/providers/gateway.ts";
import { Lightsail } from "@/network/providers/lightsail.ts";
import { Nodies } from "@/network/providers/nodies.ts";

/**
 * Extended health response type that includes additional fields missing from the SDK.
 * @see https://github.com/stellar/js-stellar-sdk/issues/1289
 */
type GetHealthResponse = Api.GetHealthResponse & {
  /** The most recent ledger available on the RPC */
  latestLedger: number;
  /** The oldest ledger available on the RPC */
  oldestLedger: number;
  /** The number of ledgers retained by the RPC */
  ledgerRetentionWindow: number;
};

/**
 * Integration tests for RPC providers.
 * These tests verify that each provider's RPC endpoint is healthy and accessible.
 */
describe("RPC Provider Health Checks", () => {
  describe("Gateway", () => {
    it("MainNet should be healthy", async () => {
      const config = Gateway.MainNet();
      const server = new Server(config.rpcUrl);
      const health = (await server.getHealth()) as GetHealthResponse;
      assertEquals(health.status, "healthy");
    });

    it("TestNet should be healthy", async () => {
      const config = Gateway.TestNet();
      const server = new Server(config.rpcUrl);
      const health = (await server.getHealth()) as GetHealthResponse;
      assertEquals(health.status, "healthy");
    });
  });

  describe("Lightsail", () => {
    it("MainNet should be healthy", async () => {
      const config = Lightsail.MainNet();
      const server = new Server(config.rpcUrl);
      const health = (await server.getHealth()) as GetHealthResponse;
      assertEquals(health.status, "healthy");
    });
  });

  describe("Nodies", () => {
    it("MainNet should be healthy", async () => {
      const config = Nodies.MainNet();
      const server = new Server(config.rpcUrl);
      const health = (await server.getHealth()) as GetHealthResponse;
      assertEquals(health.status, "healthy");
    });

    it("TestNet should be healthy", async () => {
      const config = Nodies.TestNet();
      const server = new Server(config.rpcUrl);
      const health = (await server.getHealth()) as GetHealthResponse;
      assertEquals(health.status, "healthy");
    });
  });
});
