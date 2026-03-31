// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { StellarAssetContract } from "./index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import * as SACError from "./error.ts";
import type { Server } from "stellar-sdk/rpc";
import { Asset, nativeToScVal, type TransactionBuilder } from "stellar-sdk";
import { Method } from "./types.ts";
import type { ContractId } from "@/strkeys/types.ts";

describe("StellarAssetContract initialization", () => {
  const networkConfig = NetworkConfig.TestNet();
  const issuer = LocalSigner.generateRandom();
  const contractId = new Asset("TEST", issuer.publicKey()).contractId(
    networkConfig.networkPassphrase,
  ) as ContractId;

  describe("NativeXLM static factory", () => {
    it("creates a SAC instance for native XLM from network config", () => {
      const sac = StellarAssetContract.NativeXLM(networkConfig);

      assertEquals(sac.code, "XLM");
      assertEquals(sac.isNativeXLM(), true);
      assertEquals(
        sac.contractId,
        Asset.native().contractId(networkConfig.networkPassphrase),
      );
    });

    it("accepts runtime options when creating the native XLM SAC", () => {
      const sac = StellarAssetContract.NativeXLM({
        networkConfig,
        options: { cache: { enabled: false } },
      });

      assertEquals(sac.code, "XLM");
      assertEquals(sac.isNativeXLM(), true);
    });
  });

  describe("construction helpers", () => {
    it("creates a SAC instance from asset identity", () => {
      const sac = StellarAssetContract.fromAsset({
        code: "TEST",
        issuer: issuer.publicKey(),
        networkConfig,
      });

      assertEquals(sac.code, "TEST");
      assertEquals(sac.contractId, contractId);
      assertEquals(sac.isNativeXLM(), false);
    });

    it("creates a SAC instance from a stellar-sdk Asset", () => {
      const sac = StellarAssetContract.fromAsset({
        asset: new Asset("TEST", issuer.publicKey()),
        networkConfig,
      });

      assertEquals(sac.code, "TEST");
      assertEquals(sac.contractId, contractId);
    });

    it("creates a SAC instance from the native stellar-sdk Asset", () => {
      const sac = StellarAssetContract.fromAsset({
        asset: Asset.native(),
        networkConfig,
      });

      assertEquals(sac.code, "XLM");
      assertEquals(
        sac.contractId,
        Asset.native().contractId(networkConfig.networkPassphrase),
      );
      assertEquals(sac.isNativeXLM(), true);
    });

    it("creates a SAC instance from a contract id", () => {
      const sac = new StellarAssetContract({
        contractId,
        networkConfig,
      });

      assertEquals(sac.contractId, contractId);
      assertEquals(sac.code, undefined);
      assertEquals(sac.isNativeXLM(), false);
    });

    it("creates a SAC instance from contract id through the static helper", () => {
      const sac = StellarAssetContract.fromContractId({
        contractId,
        networkConfig,
      });

      assertEquals(sac.contractId, contractId);
      assertEquals(sac.code, undefined);
    });

    it("static deploy creates a SAC instance and delegates deployment", async () => {
      const txConfig: TransactionConfig = {
        fee: "10000000",
        timeout: 30,
        source: issuer.publicKey(),
        signers: [issuer],
      };

      const originalDeploy = (StellarAssetContract.prototype as any).deploy;
      let receivedConfig: TransactionConfig | undefined;

      Object.defineProperty(StellarAssetContract.prototype, "deploy", {
        value: function (config: TransactionConfig): Promise<void> {
          receivedConfig = config;
          return Promise.resolve();
        },
        configurable: true,
        writable: true,
      });

      try {
        const sac = await StellarAssetContract.deploy({
          code: "TEST",
          issuer: issuer.publicKey(),
          networkConfig,
          config: txConfig,
        });

        assertEquals(sac.code, "TEST");
        assertEquals(sac.contractId, contractId);
        assertStrictEquals(receivedConfig, txConfig);
      } finally {
        Object.defineProperty(StellarAssetContract.prototype, "deploy", {
          value: originalDeploy,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});

describe("StellarAssetContract memoized descriptive reads", () => {
  const networkConfig = NetworkConfig.TestNet();
  const issuer = LocalSigner.generateRandom();
  const contractId = new Asset("TEST", issuer.publicKey()).contractId(
    networkConfig.networkPassphrase,
  ) as ContractId;

  let restoreReadRaw: (() => void) | undefined;

  afterEach(() => {
    restoreReadRaw?.();
    restoreReadRaw = undefined;
  });

  const mockReadRaw = (
    sac: StellarAssetContract,
    implementation: (
      args: { method: Method },
    ) => Promise<unknown>,
  ) => {
    const originalReadRaw = sac.contract.readRaw.bind(sac.contract);

    Object.defineProperty(sac.contract, "readRaw", {
      value: implementation,
      configurable: true,
      writable: true,
    });

    restoreReadRaw = () => {
      Object.defineProperty(sac.contract, "readRaw", {
        value: originalReadRaw,
        configurable: true,
        writable: true,
      });
    };
  };

  it("memoizes descriptive reads when cache is enabled", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
      options: { cache: { enabled: true } },
    });

    let readCount = 0;
    mockReadRaw(sac, ({ method }) => {
      readCount++;
      switch (method) {
        case Method.Decimals:
          return Promise.resolve(nativeToScVal(7, { type: "u32" }));
        case Method.Name:
          return Promise.resolve(
            nativeToScVal("TEST:ISSUER", { type: "string" }),
          );
        case Method.Symbol:
          return Promise.resolve(nativeToScVal("TEST", { type: "string" }));
        default:
          return Promise.reject(new Error(`unexpected method: ${method}`));
      }
    });

    assertEquals(await sac.decimals(), 7);
    assertEquals(await sac.decimals(), 7);
    assertEquals(await sac.name(), "TEST:ISSUER");
    assertEquals(await sac.name(), "TEST:ISSUER");
    assertEquals(await sac.symbol(), "TEST");
    assertEquals(await sac.symbol(), "TEST");
    assertEquals(readCount, 3);
  });

  it("skips descriptive read memoization when cache is disabled", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
      options: { cache: { enabled: false } },
    });

    let readCount = 0;
    mockReadRaw(sac, ({ method }) => {
      readCount++;
      switch (method) {
        case Method.Decimals:
          return Promise.resolve(nativeToScVal(7, { type: "u32" }));
        case Method.Name:
          return Promise.resolve(
            nativeToScVal("TEST:ISSUER", { type: "string" }),
          );
        case Method.Symbol:
          return Promise.resolve(nativeToScVal("TEST", { type: "string" }));
        default:
          return Promise.reject(new Error(`unexpected method: ${method}`));
      }
    });

    await sac.decimals();
    await sac.decimals();
    await sac.name();
    await sac.name();
    await sac.symbol();
    await sac.symbol();

    assertEquals(readCount, 6);
  });

  it("recomputes descriptive reads when the TTL expires", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
      options: { cache: { ttl: 0 } },
    });

    let readCount = 0;
    mockReadRaw(sac, () => {
      readCount++;
      return Promise.resolve(nativeToScVal("TEST:ISSUER", { type: "string" }));
    });

    assertEquals(await sac.name(), "TEST:ISSUER");
    await new Promise((resolve) => setTimeout(resolve, 1));
    assertEquals(await sac.name(), "TEST:ISSUER");
    assertEquals(readCount, 2);
  });

  it("evicts rejected descriptive reads by default", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
    });

    let readCount = 0;
    mockReadRaw(sac, () => {
      readCount++;
      if (readCount === 1) {
        return Promise.reject(new Error("temporary"));
      }

      return Promise.resolve(nativeToScVal("TEST:ISSUER", { type: "string" }));
    });

    await assertRejects(() => sac.name(), Error, "temporary");
    assertEquals(await sac.name(), "TEST:ISSUER");
    assertEquals(readCount, 2);
  });

  it("can cache rejected descriptive reads when configured", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
      options: { cache: { cacheRejected: true } },
    });

    let readCount = 0;
    mockReadRaw(sac, () => {
      readCount++;
      return Promise.reject(new Error("boom"));
    });

    await assertRejects(() => sac.name(), Error, "boom");
    await assertRejects(() => sac.name(), Error, "boom");
    assertEquals(readCount, 1);
  });
});

describe("StellarAssetContract deployment error handling", () => {
  const networkConfig = NetworkConfig.TestNet();
  const issuer = LocalSigner.generateRandom();

  const txConfig: TransactionConfig = {
    fee: "10000000",
    timeout: 30,
    source: issuer.publicKey(),
    signers: [issuer],
  };

  const createMockInput = () => ({
    transaction: {} as ReturnType<typeof TransactionBuilder.prototype.build>,
    rpc: {} as Server,
  });

  let restoreInvokePipe: (() => void) | undefined;

  afterEach(() => {
    restoreInvokePipe?.();
    restoreInvokePipe = undefined;
  });

  const invokePrivateDeploy = async (
    sac: StellarAssetContract,
  ): Promise<void> => {
    await (
      sac as unknown as {
        deploy(config: TransactionConfig): Promise<void>;
      }
    ).deploy(txConfig);
  };

  const mockInvokePipeRun = (
    sac: StellarAssetContract,
    run: () => never | Promise<never>,
  ) => {
    const originalInvokePipe = sac.contract.invokePipe;

    Object.defineProperty(sac.contract, "invokePipe", {
      value: { run },
      configurable: true,
      writable: true,
    });

    restoreInvokePipe = () => {
      Object.defineProperty(sac.contract, "invokePipe", {
        value: originalInvokePipe,
        configurable: true,
        writable: true,
      });
    };
  };

  it("throws MISSING_ARG when private deploy lacks code metadata", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId: new Asset("TEST", issuer.publicKey()).contractId(
        networkConfig.networkPassphrase,
      ) as ContractId,
      networkConfig,
    });

    const error = await assertRejects(
      () => invokePrivateDeploy(sac),
      SACError.MISSING_ARG,
    );

    assertEquals(
      (error.meta.data as { argName: string }).argName,
      "code",
    );
  });

  it("throws MISSING_ARG when private deploy lacks issuer metadata", async () => {
    const sac = StellarAssetContract.fromContractId({
      contractId: new Asset("TEST", issuer.publicKey()).contractId(
        networkConfig.networkPassphrase,
      ) as ContractId,
      networkConfig,
    });

    Object.defineProperty(sac, "code", {
      value: "TEST",
      configurable: true,
      writable: true,
    });

    const error = await assertRejects(
      () => invokePrivateDeploy(sac),
      SACError.MISSING_ARG,
    );

    assertEquals(
      (error.meta.data as { argName: string }).argName,
      "issuer",
    );
  });

  it("throws FAILED_TO_DEPLOY_CONTRACT when a non-SIMULATION_FAILED error occurs", async () => {
    const sac = StellarAssetContract.fromAsset({
      code: "TEST",
      issuer: issuer.publicKey(),
      networkConfig,
    });

    const genericError = new Error("Some unexpected network error");

    mockInvokePipeRun(sac, () => {
      throw genericError;
    });

    const error = await assertRejects(
      () => invokePrivateDeploy(sac),
      SACError.FAILED_TO_DEPLOY_CONTRACT,
    );

    assertEquals(error.code, SACError.Code.FAILED_TO_DEPLOY_CONTRACT);
    assertStrictEquals(error.meta.cause, genericError);
    const data = error.meta.data as { asset: { code: string; issuer: string } };
    assertEquals(data.asset.code, "TEST");
    assertEquals(data.asset.issuer, issuer.publicKey());
  });

  it("throws FAILED_TO_DEPLOY_CONTRACT when the simulation helper throws internally", async () => {
    const sac = StellarAssetContract.fromAsset({
      code: "TEST",
      issuer: issuer.publicKey(),
      networkConfig,
    });

    const simulationFailedError = new SIMULATION_FAILED(createMockInput(), {
      error: "Some simulation error",
      events: undefined as any,
      id: "test-id",
      latestLedger: 123456,
      _parsed: true,
    } as any);

    mockInvokePipeRun(sac, () => {
      throw simulationFailedError;
    });

    const error = await assertRejects(
      () => invokePrivateDeploy(sac),
      SACError.FAILED_TO_DEPLOY_CONTRACT,
    );

    assertEquals(error.code, SACError.Code.FAILED_TO_DEPLOY_CONTRACT);
    assertStrictEquals(error.meta.cause, simulationFailedError);
  });

  it("throws FAILED_TO_DEPLOY_CONTRACT when simulation errors do not indicate an existing SAC", async () => {
    const sac = StellarAssetContract.fromAsset({
      code: "TEST",
      issuer: issuer.publicKey(),
      networkConfig,
    });

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

    mockInvokePipeRun(sac, () => {
      throw simulationFailedError;
    });

    const error = await assertRejects(
      () => invokePrivateDeploy(sac),
      SACError.FAILED_TO_DEPLOY_CONTRACT,
    );

    assertEquals(error.code, SACError.Code.FAILED_TO_DEPLOY_CONTRACT);
    assertStrictEquals(error.meta.cause, simulationFailedError);
  });
});
