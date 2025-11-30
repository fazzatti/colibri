import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assert, assertEquals, assertExists } from "@std/assert";
import { beforeAll, describe, it } from "@std/testing/bdd";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import { StellarAssetContract } from "@/asset/sac/index.ts";
import {
  Asset,
  AuthClawbackEnabledFlag,
  AuthRevocableFlag,
  Operation,
  xdr,
  type AuthFlag,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { toStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import { PIPE_ClassicTransaction } from "@/pipelines/classic-transaction/index.ts";
import type { TransactionSigner } from "@/signer/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import * as SACError from "@/asset/sac/error.ts";

describe("[Testnet] Stellar Asset Contract", disableSanitizeConfig, () => {
  const networkConfig = NetworkConfig.TestNet();

  const setupIssuerFlags = async (
    publicKey: Ed25519PublicKey,
    networkConfig: NetworkConfig,
    config: TransactionConfig
  ) => {
    const pipe = PIPE_ClassicTransaction.create({ networkConfig });
    const op = Operation.setOptions({
      source: publicKey,
      setFlags: (AuthRevocableFlag | AuthClawbackEnabledFlag) as AuthFlag,
    });

    await pipe.run({ operations: [op], config });
  };

  const addTrustline = async (
    users: TransactionSigner[],
    asset: Asset,
    networkConfig: NetworkConfig,
    config: TransactionConfig
  ) => {
    const pipe = PIPE_ClassicTransaction.create({ networkConfig });
    const operations: xdr.Operation[] = [];

    for (const user of users) {
      operations.push(
        Operation.changeTrust({
          asset: asset,
          source: user.publicKey(),
        })
      );
    }

    await pipe.run({ operations, config });
  };

  let colibriSAC: StellarAssetContract;

  const issuer = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const userA = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const userB = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const code = "COLIBRI";

  const asset = new Asset(code, issuer.address());
  const contractId = asset.contractId(networkConfig.networkPassphrase);

  const txConfig: TransactionConfig = {
    fee: "10000000", // 1 XLM
    timeout: 30,
    source: issuer.address(),
    signers: [issuer.signer()],
  };

  beforeAll(async () => {
    await initializeWithFriendbot(networkConfig.friendbotUrl, issuer.address());
    await initializeWithFriendbot(networkConfig.friendbotUrl, userA.address());
    await initializeWithFriendbot(networkConfig.friendbotUrl, userB.address());

    await setupIssuerFlags(issuer.address(), networkConfig, txConfig);

    await addTrustline([userA.signer(), userB.signer()], asset, networkConfig, {
      ...txConfig,
      signers: [userA.signer(), userB.signer(), issuer.signer()],
    });
  });

  describe("Core features and initialization", () => {
    it("Instantiates SAC with minimal payload", () => {
      colibriSAC = new StellarAssetContract({
        code: code,
        issuer: issuer.address(),
        networkConfig: networkConfig,
      });

      assertExists(colibriSAC);
      assertEquals(colibriSAC.code, code);
      assertEquals(colibriSAC.contractId, contractId);
      assertEquals(colibriSAC.isNativeXLM(), false);
    });

    it("Instantiates SAC for native XLM using static method", () => {
      const nativeSAC = StellarAssetContract.NativeXLM(networkConfig);

      assertExists(nativeSAC);
      assertEquals(nativeSAC.code, "XLM");
      assertEquals(nativeSAC.isNativeXLM(), true);

      // Verify the contract ID matches the native asset contract ID
      const expectedContractId = Asset.native().contractId(
        networkConfig.networkPassphrase
      );
      assertEquals(nativeSAC.contractId, expectedContractId);
    });

    it("Deploys the SAC contract for a new asset", async () => {
      await colibriSAC.deploy(txConfig);
      assertEquals(colibriSAC.contractId, contractId);
    });

    it("Handles attempting to deploy the SAC contract for a deployed asset", async () => {
      await colibriSAC.deploy(txConfig);
      assertEquals(colibriSAC.contractId, contractId);
    });

    it("Reads from descriptive contract functions", async () => {
      const name = await colibriSAC.name();
      assertEquals(name, toStellarAssetCanonicalString(code, issuer.address()));
      const symbol = await colibriSAC.symbol();
      assertEquals(symbol, code);
      const decimals = await colibriSAC.decimals();
      assertEquals(decimals, 7);
    });

    it("Gets contract footprint and ledger entry", async () => {
      const footprint = colibriSAC.getContractFootprint();
      assertExists(footprint);
      assert(footprint instanceof xdr.LedgerKey);

      const ledgerEntry = await colibriSAC.getContractInstanceLedgerEntry();
      assertExists(ledgerEntry);
      assertExists(ledgerEntry.key);
    });
  });

  describe("Admin features", () => {
    let newAdminAccount: LocalSigner;
    beforeAll(async () => {
      newAdminAccount = LocalSigner.generateRandom();

      await initializeWithFriendbot(
        networkConfig.friendbotUrl,
        newAdminAccount.publicKey()
      );
    });

    it("invokes setAdmin and admin functions", async () => {
      let currentAdmin = await colibriSAC.admin();
      assertEquals(currentAdmin, issuer.address());

      await colibriSAC.setAdmin({
        newAdmin: newAdminAccount.publicKey(),
        config: txConfig,
      });
      currentAdmin = await colibriSAC.admin();
      assertEquals(currentAdmin, newAdminAccount.publicKey());

      await colibriSAC.setAdmin({
        newAdmin: issuer.address(),
        config: {
          ...txConfig,
          signers: [newAdminAccount, issuer.signer()],
        },
      });
      currentAdmin = await colibriSAC.admin();
      assertEquals(currentAdmin, issuer.address());
    });

    it("invokes supply related functions", async () => {
      let userACurrentBalance = await colibriSAC.balance({
        id: userA.address(),
      });
      assertEquals(userACurrentBalance, 0n);

      await colibriSAC.mint({
        to: userA.address(),
        amount: 1_000_000_0000000n, // 1M COLIBRI
        config: txConfig,
      });

      userACurrentBalance = await colibriSAC.balance({
        id: userA.address(),
      });
      assertEquals(userACurrentBalance, 1_000_000_0000000n);

      await colibriSAC.burn({
        from: userA.address(),
        amount: 500_000_0000000n, // 500K COLIBRI
        config: {
          ...txConfig,
          signers: [userA.signer(), issuer.signer()],
        },
      });

      userACurrentBalance = await colibriSAC.balance({
        id: userA.address(),
      });
      assertEquals(userACurrentBalance, 500_000_0000000n);
    });

    it("handles trustline authorization", async () => {
      let isAuthorized = await colibriSAC.authorized({
        id: userB.address(),
      });
      assertEquals(isAuthorized, true);

      await colibriSAC.setAuthorized({
        id: userB.address(),
        authorize: false,
        config: txConfig,
      });

      isAuthorized = await colibriSAC.authorized({
        id: userB.address(),
      });
      assertEquals(isAuthorized, false);

      await colibriSAC.setAuthorized({
        id: userB.address(),
        authorize: true,
        config: txConfig,
      });

      isAuthorized = await colibriSAC.authorized({
        id: userB.address(),
      });
      assertEquals(isAuthorized, true);
    });

    it("clawbacks tokens from a user", async () => {
      // Mint some tokens to userB first
      await colibriSAC.mint({
        to: userB.address(),
        amount: 100_0000000n, // 100 COLIBRI
        config: txConfig,
      });

      let userBBalance = await colibriSAC.balance({
        id: userB.address(),
      });
      assertEquals(userBBalance, 100_0000000n);

      // Clawback half
      await colibriSAC.clawback({
        from: userB.address(),
        amount: 50_0000000n,
        config: txConfig,
      });

      userBBalance = await colibriSAC.balance({
        id: userB.address(),
      });
      assertEquals(userBBalance, 50_0000000n);
    });
  });

  describe("Token transfer operations", () => {
    it("transfers tokens between users", async () => {
      const transferAmount = 10_000_0000000n; // 10K COLIBRI

      const userABalanceBefore = await colibriSAC.balance({
        id: userA.address(),
      });
      const userBBalanceBefore = await colibriSAC.balance({
        id: userB.address(),
      });

      await colibriSAC.transfer({
        from: userA.address(),
        to: userB.address(),
        amount: transferAmount,
        config: {
          ...txConfig,
          signers: [userA.signer(), issuer.signer()],
        },
      });

      const userABalanceAfter = await colibriSAC.balance({
        id: userA.address(),
      });
      const userBBalanceAfter = await colibriSAC.balance({
        id: userB.address(),
      });

      assertEquals(userABalanceAfter, userABalanceBefore - transferAmount);
      assertEquals(userBBalanceAfter, userBBalanceBefore + transferAmount);
    });
  });

  describe("Allowance operations", () => {
    it("approves and checks allowance", async () => {
      const allowanceAmount = 5_000_0000000n; // 5K COLIBRI
      const rpc = new Server(networkConfig.rpcUrl);
      const currentLedger = (await rpc.getLatestLedger()).sequence;
      const expirationLedger = currentLedger + 1000; // ~83 minutes

      // Check initial allowance is 0
      let allowance = await colibriSAC.allowance({
        from: userA.address(),
        spender: userB.address(),
      });
      assertEquals(allowance, 0n);

      // Approve userB to spend userA's tokens
      await colibriSAC.approve({
        from: userA.address(),
        spender: userB.address(),
        amount: allowanceAmount,
        expirationLedger,
        config: {
          ...txConfig,
          signers: [userA.signer(), issuer.signer()],
        },
      });

      // Check allowance is now set
      allowance = await colibriSAC.allowance({
        from: userA.address(),
        spender: userB.address(),
      });
      assertEquals(allowance, allowanceAmount);
    });

    it("transfers tokens using transferFrom", async () => {
      // First ensure userB has allowance (from previous test)
      const allowance = await colibriSAC.allowance({
        from: userA.address(),
        spender: userB.address(),
      });
      assert(allowance > 0n, "UserB should have allowance from userA");

      const transferAmount = 1_000_0000000n; // 1K COLIBRI

      const userABalanceBefore = await colibriSAC.balance({
        id: userA.address(),
      });
      const userBBalanceBefore = await colibriSAC.balance({
        id: userB.address(),
      });

      // userB transfers from userA to themselves using allowance
      await colibriSAC.transferFrom({
        spender: userB.address(),
        from: userA.address(),
        to: userB.address(),
        amount: transferAmount,
        config: {
          ...txConfig,
          signers: [userB.signer(), issuer.signer()],
        },
      });

      const userABalanceAfter = await colibriSAC.balance({
        id: userA.address(),
      });
      const userBBalanceAfter = await colibriSAC.balance({
        id: userB.address(),
      });

      assertEquals(userABalanceAfter, userABalanceBefore - transferAmount);
      assertEquals(userBBalanceAfter, userBBalanceBefore + transferAmount);

      // Check allowance has been reduced
      const newAllowance = await colibriSAC.allowance({
        from: userA.address(),
        spender: userB.address(),
      });
      assertEquals(newAllowance, allowance - transferAmount);
    });

    it("burns tokens using burnFrom", async () => {
      // Set up a new allowance for burning
      const burnAllowance = 500_0000000n; // 500 COLIBRI
      const rpc = new Server(networkConfig.rpcUrl);
      const currentLedger = (await rpc.getLatestLedger()).sequence;
      const expirationLedger = currentLedger + 1000;

      // Approve userB to burn userA's tokens
      await colibriSAC.approve({
        from: userA.address(),
        spender: userB.address(),
        amount: burnAllowance,
        expirationLedger,
        config: {
          ...txConfig,
          signers: [userA.signer(), issuer.signer()],
        },
      });

      const userABalanceBefore = await colibriSAC.balance({
        id: userA.address(),
      });

      const burnAmount = 200_0000000n; // 200 COLIBRI

      // userB burns from userA using allowance
      await colibriSAC.burnFrom({
        spender: userB.address(),
        from: userA.address(),
        amount: burnAmount,
        config: {
          ...txConfig,
          signers: [userB.signer(), issuer.signer()],
        },
      });

      const userABalanceAfter = await colibriSAC.balance({
        id: userA.address(),
      });
      assertEquals(userABalanceAfter, userABalanceBefore - burnAmount);

      // Check allowance has been reduced
      const newAllowance = await colibriSAC.allowance({
        from: userA.address(),
        spender: userB.address(),
      });
      assertEquals(newAllowance, burnAllowance - burnAmount);
    });
  });

  describe("Error classes", () => {
    it("MISSING_ARG error has correct structure", () => {
      const error = new SACError.MISSING_ARG("testArg");

      assertEquals(error.code, SACError.Code.MISSING_ARG);
      assertEquals(error.message, "Missing required argument: testArg");
      assert(error.details?.includes("testArg"));
      assertEquals((error.meta.data as { argName: string }).argName, "testArg");
    });

    it("FAILED_TO_WRAP_ASSET error has correct structure", () => {
      const testAsset = new Asset("TEST", issuer.address());
      const cause = new Error("Test cause");
      const error = new SACError.FAILED_TO_WRAP_ASSET(testAsset, cause);

      assertEquals(error.code, SACError.Code.FAILED_TO_WRAP_ASSET);
      assertEquals(error.message, "Failed to wrap asset");
      assertEquals(error.meta.cause, cause);
      const data = error.meta.data as {
        asset: { code: string; issuer: string };
      };
      assertEquals(data.asset.code, "TEST");
      assertEquals(data.asset.issuer, issuer.address());
    });

    it("UNMATCHED_CONTRACT_ID error has correct structure", () => {
      const expected = "CAAAA...";
      const found = "CBBBB...";
      const error = new SACError.UNMATCHED_CONTRACT_ID(expected, found);

      assertEquals(error.code, SACError.Code.UNMATCHED_CONTRACT_ID);
      assertEquals(error.message, "Unmatched contract ID");
      assert(error.details?.includes(expected));
      assert(error.details?.includes(found));
      const data = error.meta.data as { expected: string; found: string };
      assertEquals(data.expected, expected);
      assertEquals(data.found, found);
    });

    it("MISSING_RETURN_VALUE error has correct structure", () => {
      const functionName = "balance";
      const error = new SACError.MISSING_RETURN_VALUE(functionName);

      assertEquals(error.code, SACError.Code.MISSING_RETURN_VALUE);
      assertEquals(error.message, "Missing return value");
      assert(error.details?.includes(functionName));
      const data = error.meta.data as { functionName: string };
      assertEquals(data.functionName, functionName);
    });
  });
});
