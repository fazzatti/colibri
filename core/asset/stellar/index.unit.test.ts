import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset, Claimant, Memo, Operation } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { StellarAsset } from "@/asset/stellar/index.ts";
import type { StellarAssetArgs } from "@/asset/stellar/types.ts";
import * as E from "@/asset/stellar/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { BASE_FEE_TOO_LOW_ERROR } from "@/processes/build-transaction/error.ts";
import { INVALID_ACCOUNT_ID } from "@/ledger-entries/error.ts";

describe("StellarAsset", () => {
  const issuer = LocalSigner.generateRandom();
  const holder = LocalSigner.generateRandom();
  const other = LocalSigner.generateRandom();
  const networkConfig = NetworkConfig.TestNet();
  const asset = new Asset("USD", issuer.publicKey());
  const config: TransactionConfig = {
    source: holder.publicKey(),
    signers: [holder],
    fee: "0",
    timeout: 70,
    memo: Memo.text("asset example"),
  };

  it("exposes native identity, exact units and an explicitly separate SAC binding", () => {
    const usd = StellarAsset.fromCanonical({
      canonical: `USD:${issuer.publicKey()}`,
      networkConfig,
    });
    assertEquals(usd.code, "USD");
    assertEquals(usd.issuer, issuer.publicKey());
    assertEquals(usd.symbol(), "USD");
    assertEquals(usd.decimals(), 7);
    assertEquals(usd.isNative(), false);
    assertEquals(usd.toString(), `USD:${issuer.publicKey()}`);
    assertEquals(usd.parseAmount("1.25"), 12_500_000n);
    assertEquals(usd.formatAmount(12_500_000n), "1.25");
    const xlm = StellarAsset.NativeXLM({ networkConfig });
    assertEquals(xlm.isNative(), true);
    assertEquals(xlm.issuer, undefined);
    assertEquals(xlm.toString(), "native");
    assertEquals(
      StellarAsset.fromCanonical({ canonical: "native", networkConfig }).asset
        .equals(xlm.asset),
      true,
    );
    assertThrows(
      () => StellarAsset.fromCanonical({ canonical: "USD", networkConfig }),
      E.INVALID_CANONICAL_ASSET,
    );
    for (const value of [usd, xlm]) {
      const sac = value.toContract();
      assertEquals(
        sac.contractId,
        value.asset.contractId(networkConfig.networkPassphrase),
      );
      assertStrictEquals(sac.contract.networkConfig, networkConfig);
      assertStrictEquals(sac.contract.rpc, value.rpc);
      assert(sac.contract.invokePipe !== value.transactionPipe as unknown);
    }
  });

  it("keeps issuer balances undefined and wraps only actual account transport failures", async () => {
    const rpc = new Server("http://127.0.0.1:0", { allowHttp: true });
    const usd = new StellarAsset({ asset, networkConfig, rpc });
    await assertRejects(
      () => usd.balance({ id: issuer.publicKey() }),
      E.ISSUER_BALANCE_UNDEFINED,
    );
    await assertRejects(
      () => usd.balance({ id: holder.publicKey() }),
      E.READ_TRUSTLINE_FAILED,
    );
    const xlm = StellarAsset.NativeXLM({ networkConfig, rpc });
    const error = await assertRejects(
      () => xlm.balance({ id: holder.publicKey() }),
      E.READ_BALANCE_FAILED,
    );
    assert(error.meta?.cause instanceof Error);
    await assertRejects(
      () => xlm.balance({ id: "Ginvalid" }),
      INVALID_ACCOUNT_ID,
    );
  });

  it("identifies SAC binding failure without leaking a native hashing exception", () => {
    const invalidNetwork = {
      ...networkConfig,
      networkPassphrase: 42,
    } as unknown as NetworkConfig;
    const invalid = new StellarAsset({
      asset,
      networkConfig: invalidNetwork,
      rpc: new Server(networkConfig.rpcUrl!),
    });
    const error = assertThrows(
      () => invalid.toContract(),
      E.SAC_BINDING_FAILED,
    );
    assert(error.meta?.cause instanceof Error);
    assertEquals(E.ERROR_STAS[error.code], error.constructor);
  });

  it("mints and burns using explicit issuer payment endpoints", async () => {
    const usd = new StellarAsset({ asset, networkConfig });
    const issue = await assertRejects(
      () => usd.mint({ destination: holder.publicKey(), amount: "2", config }),
      BASE_FEE_TOO_LOW_ERROR,
    );
    const redemption = await assertRejects(
      () => usd.burn({ amount: "2", config }),
      BASE_FEE_TOO_LOW_ERROR,
    );
    assertEquals(
      Operation.fromXdrObject(issue.meta.data.input.operations[0]),
      Operation.fromXdrObject(
        Operation.payment({
          asset,
          destination: holder.publicKey(),
          source: issuer.publicKey(),
          amount: "2",
        }),
      ),
    );
    assertEquals(
      Operation.fromXdrObject(redemption.meta.data.input.operations[0]),
      Operation.fromXdrObject(
        Operation.payment({
          asset,
          destination: issuer.publicKey(),
          source: holder.publicKey(),
          amount: "2",
        }),
      ),
    );
    const xlm = StellarAsset.NativeXLM({ networkConfig });
    await assertRejects(
      () => xlm.mint({ destination: holder.publicKey(), amount: "1", config }),
      E.NATIVE_MINT,
    );
    await assertRejects(
      () => xlm.burn({ amount: "1", config }),
      E.NATIVE_BURN,
    );
  });

  it("retains native Asset and RPC instances and exposes the existing owned pipeline", () => {
    const rpc = new Server(networkConfig.rpcUrl!);
    const usd = new StellarAsset({ asset, networkConfig, rpc });
    assertStrictEquals(usd.asset, asset);
    assertStrictEquals(usd.rpc, rpc);
    assertStrictEquals(usd.ledgerEntries.rpc, rpc);
    assertStrictEquals(usd.networkConfig, networkConfig);
    assertEquals(usd.transactionPipe.id, "ClassicTransactionPipeline");
    assertEquals(typeof usd.transactionPipe, "function");
    assertEquals("getHolderState" in usd, false);
    assertEquals("issue" in usd, false);
    assertEquals("redeem" in usd, false);
    assertEquals(
      new StellarAsset({
        code: "USD",
        issuer: issuer.publicKey(),
        networkConfig,
      }).asset.equals(asset),
      true,
    );
    assertEquals(
      new StellarAsset({ code: "XLM", issuer: "native", networkConfig }).asset
        .isNative(),
      true,
    );
    const local = new StellarAsset({
      asset,
      networkConfig: NetworkConfig.TestNet({
        rpcUrl: "http://localhost:8000/rpc",
        allowHttp: true,
      }),
    });
    assertEquals(local.rpc.serverURL.toString(), "http://localhost:8000/rpc");
    const custom = new StellarAsset({
      asset,
      networkConfig: NetworkConfig.CustomNet({
        networkPassphrase: "custom",
        rpcUrl: "https://localhost:8443/rpc",
      }),
    });
    assertEquals(custom.rpc.serverURL.toString(), "https://localhost:8443/rpc");
  });

  it("uses distinct typed construction errors", () => {
    for (const code of ["USD", "USDC", "xlm", ""]) {
      assertThrows(
        () =>
          new StellarAsset(
            {
              code,
              issuer: "native",
              networkConfig,
            } as unknown as StellarAssetArgs,
          ),
        E.NATIVE_ASSET_CODE_MISMATCH,
      );
    }
    assertEquals(
      new StellarAsset({
        code: "XLM",
        issuer: issuer.publicKey(),
        networkConfig,
      }).asset.isNative(),
      false,
    );
    assertThrows(
      () =>
        new StellarAsset({
          code: "TOO_LONG_ASSET_CODE",
          issuer: issuer.publicKey(),
          networkConfig,
        }),
      E.INVALID_ASSET,
    );
    assertThrows(
      () =>
        new StellarAsset({
          asset,
          networkConfig: NetworkConfig.CustomNet({ networkPassphrase: "test" }),
        }),
      E.MISSING_RPC_URL,
    );
    assertThrows(
      () =>
        new StellarAsset({
          asset,
          networkConfig: NetworkConfig.TestNet({
            rpcUrl: "http://localhost:8000",
          }),
        }),
      E.INVALID_RPC,
    );
  });

  it("returns no issuer/trustline for native XLM and rejects its issuer-only operations distinctly", async () => {
    const xlm = new StellarAsset({ asset: Asset.native(), networkConfig });
    assertEquals(await xlm.getIssuer(), null);
    assertEquals(await xlm.getTrustline(holder.publicKey()), null);
    await assertRejects(() => xlm.changeTrust({ config }), E.NATIVE_TRUSTLINE);
    await assertRejects(
      () =>
        xlm.setTrustLineFlags({
          trustor: holder.publicKey(),
          flags: { authorized: true },
          config,
        }),
      E.NATIVE_TRUSTLINE_FLAGS,
    );
    await assertRejects(
      () => xlm.clawback({ from: holder.publicKey(), amount: "1", config }),
      E.NATIVE_CLAWBACK,
    );
    await assertRejects(
      () => new StellarAsset({ asset, networkConfig }).getTrustline("Ginvalid"),
      INVALID_ACCOUNT_ID,
    );
  });

  it("wraps each SDK operation-construction failure at its own typed site", async () => {
    const usd = new StellarAsset({ asset, networkConfig });
    const errors = [
      await assertRejects(
        () => usd.changeTrust({ limit: "-1", config }),
        E.CHANGE_TRUST_FAILED,
      ),
      await assertRejects(
        () => usd.transfer({ destination: "invalid", amount: "1", config }),
        E.TRANSFER_FAILED,
      ),
      await assertRejects(
        () =>
          usd.setTrustLineFlags({
            trustor: "invalid",
            flags: { authorized: true },
            config,
          }),
        E.TRUSTLINE_FLAGS_FAILED,
      ),
      await assertRejects(
        () => usd.clawback({ from: "invalid", amount: "1", config }),
        E.CLAWBACK_FAILED,
      ),
    ];
    for (const error of errors) assert(error.meta?.cause instanceof Error);
  });

  it("wraps real connection failures in separate issuer and trustline read errors", async () => {
    // Port zero cannot serve an RPC endpoint. This uses native HTTP transport,
    // not a mock server or an overridden LedgerEntries method.
    const rpc = new Server("http://127.0.0.1:0", { allowHttp: true });
    const usd = new StellarAsset({ asset, networkConfig, rpc });
    const issuerError = await assertRejects(
      () => usd.getIssuer(),
      E.READ_ISSUER_FAILED,
    );
    const trustlineError = await assertRejects(
      () => usd.getTrustline(holder.publicKey()),
      E.READ_TRUSTLINE_FAILED,
    );
    assert(issuerError.meta?.cause instanceof Error);
    assert(trustlineError.meta?.cause instanceof Error);
  });

  it("executes the real pipeline and preserves the constructed operation/config at its fee-validation boundary", async () => {
    const usd = new StellarAsset({ asset, networkConfig });
    // A genuinely invalid fee reaches the real builder and stops before RPC.
    // Nothing is mocked: the typed process error retains its actual input.
    const defaults = [
      {
        invoke: () => usd.changeTrust({ limit: "123", config }),
        expected: Operation.changeTrust({
          asset,
          limit: "123",
          source: holder.publicKey(),
        }),
      },
      {
        invoke: () =>
          usd.transfer({
            destination: other.publicKey(),
            amount: "2.5",
            config,
          }),
        expected: Operation.payment({
          asset,
          destination: other.publicKey(),
          amount: "2.5",
          source: holder.publicKey(),
        }),
      },
      {
        invoke: () =>
          usd.setTrustLineFlags({
            trustor: holder.publicKey(),
            flags: { authorized: true },
            config,
          }),
        expected: Operation.setTrustLineFlags({
          asset,
          trustor: holder.publicKey(),
          flags: { authorized: true },
          source: issuer.publicKey(),
        }),
      },
      {
        invoke: () =>
          usd.clawback({ from: holder.publicKey(), amount: "1", config }),
        expected: Operation.clawback({
          asset,
          from: holder.publicKey(),
          amount: "1",
          source: issuer.publicKey(),
        }),
      },
    ];
    for (const { invoke, expected } of defaults) {
      const error = await assertRejects(invoke, BASE_FEE_TOO_LOW_ERROR);
      assertEquals(
        error.meta.data.input.operations[0].toXdr("base64"),
        expected.toXdr("base64"),
      );
      assertEquals(error.meta.data.input.source, config.source);
      assertStrictEquals(error.meta.data.input.memo, config.memo);
      assertEquals(
        error.meta.data.input.preconditions?.timeoutSeconds,
        config.timeout,
      );
    }
    const explicitSource = other.publicKey();
    const explicit = [
      () => usd.changeTrust({ source: explicitSource, config }),
      () =>
        usd.transfer({
          source: explicitSource,
          destination: holder.publicKey(),
          amount: "1",
          config,
        }),
      () =>
        usd.setTrustLineFlags({
          source: explicitSource,
          trustor: holder.publicKey(),
          flags: { authorized: false },
          config,
        }),
      () =>
        usd.clawback({
          source: explicitSource,
          from: holder.publicKey(),
          amount: "1",
          config,
        }),
    ];
    for (const invoke of explicit) {
      const error = await assertRejects(invoke, BASE_FEE_TOO_LOW_ERROR);
      assertEquals(
        Operation.fromXdrObject(error.meta.data.input.operations[0]).source,
        explicitSource,
      );
    }
  });

  it("exposes a unique stable constructor for every asset error", () => {
    const errors = [
      new E.INVALID_ASSET("cause"),
      new E.MISSING_RPC_URL(),
      new E.INVALID_RPC("cause"),
      new E.NATIVE_TRUSTLINE(),
      new E.CHANGE_TRUST_FAILED("cause"),
      new E.TRANSFER_FAILED("cause"),
      new E.NATIVE_TRUSTLINE_FLAGS(),
      new E.TRUSTLINE_FLAGS_FAILED("cause"),
      new E.NATIVE_CLAWBACK(),
      new E.CLAWBACK_FAILED("cause"),
      new E.READ_ISSUER_FAILED("cause"),
      new E.READ_TRUSTLINE_FAILED("cause"),
      new E.NATIVE_ASSET_CODE_MISMATCH("USD"),
      new E.NATIVE_AUTHORIZATION(),
      new E.AUTHORIZATION_TRUSTLINE_MISSING(holder.publicKey()),
      new E.CREATE_CLAIMABLE_BALANCE_FAILED("cause"),
    ];
    assertEquals(
      new Set(errors.map((error) => error.code)).size,
      errors.length,
    );
    for (const error of errors) {
      assertEquals(E.ERROR_STAS[error.code], error.constructor);
    }
  });

  it("authorizes with issuer-owned flags and rejects unsupported authorization distinctly", async () => {
    const usd = new StellarAsset({ asset, networkConfig });
    const error = await assertRejects(
      () =>
        usd.setAuthorized({ id: holder.publicKey(), authorize: true, config }),
      BASE_FEE_TOO_LOW_ERROR,
    );
    assertEquals(
      error.meta.data.input.operations[0].toXdr("base64"),
      Operation.setTrustLineFlags({
        asset,
        source: issuer.publicKey(),
        trustor: holder.publicKey(),
        flags: { authorized: true, authorizedToMaintainLiabilities: false },
      }).toXdr("base64"),
    );
    await assertRejects(
      () =>
        StellarAsset.NativeXLM({ networkConfig }).setAuthorized({
          id: holder.publicKey(),
          authorize: false,
          config,
        }),
      E.NATIVE_AUTHORIZATION,
    );
    await assertRejects(
      () => usd.setAuthorized({ id: "Ginvalid", authorize: true, config }),
      E.TRUSTLINE_FLAGS_FAILED,
    );
    const offline = new StellarAsset({
      asset,
      networkConfig,
      rpc: new Server("http://127.0.0.1:0", { allowHttp: true }),
    });
    await assertRejects(
      () =>
        offline.setAuthorized({
          id: holder.publicKey(),
          authorize: false,
          config,
        }),
      E.READ_TRUSTLINE_FAILED,
    );
  });

  it("creates bound-asset claimable balances through the real pipeline with default and explicit sources", async () => {
    const claimants = [new Claimant(other.publicKey())];
    for (const nativeAsset of [asset, Asset.native()]) {
      const token = new StellarAsset({ asset: nativeAsset, networkConfig });
      for (const source of [undefined, other.publicKey()]) {
        const error = await assertRejects(
          () =>
            token.createClaimableBalance({
              amount: "1.25",
              claimants,
              source,
              config,
            }),
          BASE_FEE_TOO_LOW_ERROR,
        );
        assertEquals(
          error.meta.data.input.operations[0].toXdr("base64"),
          Operation.createClaimableBalance({
            asset: nativeAsset,
            amount: "1.25",
            claimants,
            source: source ?? config.source,
          }).toXdr("base64"),
        );
        assertStrictEquals(error.meta.data.input.memo, config.memo);
      }
      const error = await assertRejects(
        () => token.createClaimableBalance({ amount: "-1", claimants, config }),
        E.CREATE_CLAIMABLE_BALANCE_FAILED,
      );
      assert(error.meta?.cause instanceof Error);
      await assertRejects(
        () =>
          token.createClaimableBalance({ amount: "1", claimants: [], config }),
        E.CREATE_CLAIMABLE_BALANCE_FAILED,
      );
    }
  });
});
