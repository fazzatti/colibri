// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertRejects } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { type Stub, stub } from "@std/testing/mock";
import { StellarAssetContract } from "./index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import * as SACError from "./error.ts";
import type { Server } from "stellar-sdk/rpc";
import { Asset, type TransactionBuilder } from "stellar-sdk";

describe("StellarAssetContract initialization", () => {
  const networkConfig = NetworkConfig.TestNet();

  describe("NativeXLM static factory", () => {
    it("creates a SAC instance for native XLM", () => {
      const sac = StellarAssetContract.NativeXLM(networkConfig);

      assertEquals(sac.code, "XLM");
      assertEquals(sac.isNativeXLM(), true);

      const expectedContractId = Asset.native().contractId(
        networkConfig.networkPassphrase
      );
      assertEquals(sac.contractId, expectedContractId);
    });
  });

  describe("isNativeXLM", () => {
    it("returns true for native XLM SAC", () => {
      const sac = StellarAssetContract.NativeXLM(networkConfig);
      assertEquals(sac.isNativeXLM(), true);
    });

    it("returns false for credit asset SAC", () => {
      const issuer = LocalSigner.generateRandom();
      const sac = new StellarAssetContract({
        code: "TEST",
        issuer: issuer.publicKey(),
        networkConfig,
      });
      assertEquals(sac.isNativeXLM(), false);
    });
  });

  describe("constructor with native issuer", () => {
    it("creates a SAC instance when issuer is 'native'", () => {
      const sac = new StellarAssetContract({
        code: "XLM",
        issuer: "native",
        networkConfig,
      });

      assertEquals(sac.code, "XLM");
      assertEquals(sac.isNativeXLM(), true);

      const expectedContractId = Asset.native().contractId(
        networkConfig.networkPassphrase
      );
      assertEquals(sac.contractId, expectedContractId);
    });
  });
});

describe("StellarAssetContract.deploy() error handling", () => {
  const networkConfig = NetworkConfig.TestNet();
  const issuer = LocalSigner.generateRandom();

  const txConfig: TransactionConfig = {
    fee: "10000000",
    timeout: 30,
    source: issuer.publicKey(),
    signers: [issuer],
  };

  // Create mock SimulateTransactionInput
  const createMockInput = () => ({
    transaction: {} as ReturnType<typeof TransactionBuilder.prototype.build>,
    rpc: {} as Server,
  });

  let invokePipeStub: Stub | undefined;

  afterEach(() => {
    invokePipeStub?.restore();
  });

  it("throws FAILED_TO_WRAP_ASSET when a non-SIMULATION_FAILED error occurs", async () => {
    const sac = new StellarAssetContract({
      code: "TEST",
      issuer: issuer.publicKey(),
      networkConfig,
    });

    const genericError = new Error("Some unexpected network error");

    // Stub the invokePipe.run to throw a generic error (not SIMULATION_FAILED)
    invokePipeStub = stub(sac.contract.invokePipe, "run", () => {
      throw genericError;
    });

    const error = await assertRejects(
      () => sac.deploy(txConfig),
      SACError.FAILED_TO_WRAP_ASSET
    );

    assertEquals(error.code, SACError.Code.FAILED_TO_WRAP_ASSET);
    assertEquals(error.meta.cause, genericError);
    const data = error.meta.data as { asset: { code: string; issuer: string } };
    assertEquals(data.asset.code, "TEST");
    assertEquals(data.asset.issuer, issuer.publicKey());
  });

  it("throws FAILED_TO_WRAP_ASSET when getStellarAssetContractIdFromFailedSimulationResponse throws (inner catch)", async () => {
    const sac = new StellarAssetContract({
      code: "TEST",
      issuer: issuer.publicKey(),
      networkConfig,
    });

    // Create a SIMULATION_FAILED error with invalid/malformed simulation response
    // This will cause getStellarAssetContractIdFromFailedSimulationResponse to throw
    // when it tries to access response.events[0].event().body().v0().data().vec()
    const simulationFailedError = new SIMULATION_FAILED(createMockInput(), {
      error: "Some simulation error",
      // events is undefined/null which will cause the helper to throw
      events: undefined as any,
      id: "test-id",
      latestLedger: 123456,
      _parsed: true,
    } as any);

    // Stub the invokePipe.run to throw SIMULATION_FAILED
    invokePipeStub = stub(sac.contract.invokePipe, "run", () => {
      throw simulationFailedError;
    });

    const error = await assertRejects(
      () => sac.deploy(txConfig),
      SACError.FAILED_TO_WRAP_ASSET
    );

    assertEquals(error.code, SACError.Code.FAILED_TO_WRAP_ASSET);
    assertEquals(error.meta.cause, simulationFailedError);
    const data = error.meta.data as { asset: { code: string; issuer: string } };
    assertEquals(data.asset.code, "TEST");
    assertEquals(data.asset.issuer, issuer.publicKey());
  });

  it("throws FAILED_TO_WRAP_ASSET when SIMULATION_FAILED has events that don't indicate 'contract already exists'", async () => {
    const sac = new StellarAssetContract({
      code: "TEST",
      issuer: issuer.publicKey(),
      networkConfig,
    });

    // Create a SIMULATION_FAILED error with events that exist but don't contain
    // the "contract already exists" message - this triggers the inner try block
    // to throw "The simulation response does not indicate an already wrapped asset."
    // which then gets caught by the inner catch and falls through to FAILED_TO_WRAP_ASSET
    const simulationFailedError = new SIMULATION_FAILED(createMockInput(), {
      error: "Some simulation error",
      events: [
        {
          event: () => ({
            body: () => ({
              v0: () => ({
                data: () => ({
                  vec: () => [
                    {
                      value: () => ({
                        toString: () => "some other error message",
                      }),
                    },
                  ],
                }),
              }),
            }),
          }),
        },
      ],
      id: "test-id",
      latestLedger: 123456,
      _parsed: true,
    } as any);

    // Stub the invokePipe.run to throw SIMULATION_FAILED
    invokePipeStub = stub(sac.contract.invokePipe, "run", () => {
      throw simulationFailedError;
    });

    const error = await assertRejects(
      () => sac.deploy(txConfig),
      SACError.FAILED_TO_WRAP_ASSET
    );

    assertEquals(error.code, SACError.Code.FAILED_TO_WRAP_ASSET);
    assertEquals(error.meta.cause, simulationFailedError);
  });
});
