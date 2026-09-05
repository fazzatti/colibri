import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  AuthClawbackEnabledFlag,
  AuthRequiredFlag,
  AuthRevocableFlag,
  Claimant,
  Memo,
  MuxedAccount,
  Operation,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { StellarTestLedger } from "@colibri/test-tooling";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { StellarAsset } from "@/asset/stellar/index.ts";
import { ClaimableBalancePredicates as P } from "@/claimable-balance/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import {
  type ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@/pipelines/classic-transaction/index.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { MuxedAddress } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import {
  buildClaimableBalanceLedgerKey,
  LedgerEntries,
} from "@/ledger-entries/index.ts";
import { ColibriError } from "@/error/index.ts";
import { LEDGER_ENTRY_NOT_FOUND } from "@/ledger-entries/error.ts";

describe(
  "StellarAsset and native claim predicates on Quickstart",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: `colibri-stellar-asset-${crypto.randomUUID()}`,
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const issuer = LocalSigner.generateRandom();
    const holder = LocalSigner.generateRandom();
    const recipient = LocalSigner.generateRandom();
    const channel = LocalSigner.generateRandom();
    const asset = new Asset("ASSET", issuer.publicKey());
    let networkConfig: NetworkConfig;
    let execute: ClassicTransactionPipeline;
    let usd: StellarAsset;
    let entries: LedgerEntries;

    const configFor = (signer: LocalSigner): TransactionConfig => ({
      source: signer.publicKey(),
      signers: [signer],
      fee: "100",
      timeout: 120,
      memo: Memo.text("asset workflow"),
    });

    function assertSubmittedOperation(
      result: ClassicTransactionOutput,
      expected: ReturnType<typeof Operation.payment>,
    ): void {
      const tx = TransactionBuilder.fromXdr(
        result.response.envelopeXdr.toXdr("base64"),
        networkConfig.networkPassphrase,
      );
      assert(tx instanceof Transaction);
      assertEquals(tx.operations, [Operation.fromXdrObject(expected)]);
      assertEquals(tx.memo.value, new TextEncoder().encode("asset workflow"));
      assertEquals(result.feeCharged, 100n);
      assertEquals(tx.fee, "100");
      assertEquals(result.operations.length, 1);
    }

    beforeAll(async () => {
      await ledger.start();
      networkConfig = NetworkConfig.CustomNet(
        await ledger.getNetworkConfiguration(),
      );
      execute = createClassicTransactionPipeline({ networkConfig });
      usd = new StellarAsset({ asset, networkConfig });
      entries = new LedgerEntries({ networkConfig });
      for (const signer of [issuer, holder, recipient, channel]) {
        await initializeWithFriendbot(
          networkConfig.friendbotUrl!,
          signer.publicKey(),
          { rpcUrl: networkConfig.rpcUrl!, allowHttp: networkConfig.allowHttp },
        );
      }
      // Issuer policy is explicit and separate from the asset convenience class.
      await execute({
        operations: [
          Operation.setOptions({
            setFlags: AuthRequiredFlag | AuthRevocableFlag |
              AuthClawbackEnabledFlag,
          }),
        ],
        config: configFor(issuer),
      });
    });

    afterAll(async () => {
      await ledger.stop();
      await ledger.destroy();
    });

    it("executes granular trustline, authorization, issue, clawback, redemption, and removal actions", async () => {
      assertEquals(await usd.getTrustline(holder.publicKey()), null);
      const issuerEntry = await usd.getIssuer();
      assert(issuerEntry);
      assertEquals(issuerEntry.accountId, issuer.publicKey());
      const missingIssuer = new StellarAsset({
        asset: new Asset("MISSING", LocalSigner.generateRandom().publicKey()),
        networkConfig,
      });
      await assertRejects(
        () => missingIssuer.getIssuer(),
        LEDGER_ENTRY_NOT_FOUND,
      );

      const trust = await usd.changeTrust({
        limit: "1000",
        config: configFor(holder),
      });
      assertSubmittedOperation(
        trust,
        Operation.changeTrust({
          asset,
          source: holder.publicKey(),
          limit: "1000",
        }),
      );
      assertEquals(
        (await usd.getTrustline(holder.publicKey()))?.limit,
        10_000_000_000n,
      );

      const authorize = await usd.setTrustLineFlags({
        trustor: holder.publicKey(),
        flags: { authorized: true },
        config: { ...configFor(channel), signers: [channel, issuer] },
      });
      assertSubmittedOperation(
        authorize,
        Operation.setTrustLineFlags({
          asset,
          source: issuer.publicKey(),
          trustor: holder.publicKey(),
          flags: { authorized: true },
        }),
      );

      // The owned pipeline is still the plugin-compatible existing transaction pipe.
      const plugin = createChannelAccountsPlugin({
        channels: [NativeAccount.fromMasterSigner(channel)],
      });
      usd.transactionPipe.use(plugin);
      const issue = await usd.transfer({
        destination: holder.publicKey(),
        amount: "10",
        config: configFor(issuer),
      });
      assertSubmittedOperation(
        issue,
        Operation.payment({
          asset,
          source: issuer.publicKey(),
          destination: holder.publicKey(),
          amount: "10",
        }),
      );
      const issueEnvelope = issue.response.envelopeXdr;
      assert(issueEnvelope.type === "envelopeTypeTx");
      assert(issueEnvelope.v1.tx.sourceAccount.type === "keyTypeEd25519");
      assertEquals(
        issueEnvelope.v1.tx.sourceAccount.ed25519.toBytes(),
        StrKey.decodeEd25519PublicKey(channel.publicKey()),
      );
      assertEquals(
        (await usd.getTrustline(holder.publicKey()))?.balance,
        100_000_000n,
      );

      const clawback = await usd.clawback({
        from: holder.publicKey(),
        amount: "3",
        config: configFor(issuer),
      });
      assertSubmittedOperation(
        clawback,
        Operation.clawback({
          asset,
          source: issuer.publicKey(),
          from: holder.publicKey(),
          amount: "3",
        }),
      );
      assertEquals(
        (await usd.getTrustline(holder.publicKey()))?.balance,
        70_000_000n,
      );

      const redeem = await usd.transfer({
        destination: issuer.publicKey(),
        amount: "7",
        config: configFor(holder),
      });
      assertSubmittedOperation(
        redeem,
        Operation.payment({
          asset,
          source: holder.publicKey(),
          destination: issuer.publicKey(),
          amount: "7",
        }),
      );
      assertEquals((await usd.getTrustline(holder.publicKey()))?.balance, 0n);
      await usd.changeTrust({ limit: "0", config: configFor(holder) });
      assertEquals(await usd.getTrustline(holder.publicKey()), null);
    });

    it("transfers native XLM with an explicit muxed operation source independent of the envelope", async () => {
      const xlm = new StellarAsset({ asset: Asset.native(), networkConfig });
      const source = new MuxedAccount(
        new Account(holder.publicKey(), "0"),
        "29",
      ).accountId() as MuxedAddress;
      const before = await entries.account({
        accountId: recipient.publicKey(),
      });
      const result = await xlm.transfer({
        source,
        destination: recipient.publicKey(),
        amount: "1.25",
        config: { ...configFor(channel), signers: [channel, holder] },
      });
      assertSubmittedOperation(
        result,
        Operation.payment({
          asset: Asset.native(),
          source,
          destination: recipient.publicKey(),
          amount: "1.25",
        }),
      );
      assertEquals(
        (await entries.account({ accountId: recipient.publicKey() })).balance -
          before.balance,
        12_500_000n,
      );
    });

    it("creates and claims native predicate trees while rejecting an ineligible reclaimant", async () => {
      const deadline = P.beforeAbsoluteTime(
        Math.floor(Date.now() / 1000) + 3600,
      );
      const recipientPredicate = P.and(
        deadline,
        P.or(P.unconditional(), P.beforeRelativeTime(600)),
      );
      const senderPredicate = P.not(deadline);
      const creation = await execute({
        operations: [
          Operation.createClaimableBalance({
            asset: Asset.native(),
            amount: "2",
            claimants: [
              new Claimant(recipient.publicKey(), recipientPredicate),
              new Claimant(holder.publicKey(), senderPredicate),
            ],
          }),
        ],
        config: configFor(holder),
      });
      const outcome = creation.operations[0];
      assert(outcome.type === "createClaimableBalance");
      const balanceId = outcome.result.balanceId;
      const strkeyBytes = new Uint8Array(33);
      strkeyBytes.set(balanceId.v0.toBytes(), 1);
      const key = buildClaimableBalanceLedgerKey({
        balanceId: StrKey.encodeClaimableBalance(strkeyBytes),
      });
      assertEquals((await entries.get(key))?.amount, 20_000_000n);

      const claim = Operation.claimClaimableBalance({
        balanceId: balanceId.toXdr("hex"),
      });
      await assertRejects(
        () => execute({ operations: [claim], config: configFor(holder) }),
        ColibriError,
      );
      const success = await execute({
        operations: [claim],
        config: configFor(recipient),
      });
      assertEquals(success.operations[0].type, "claimClaimableBalance");
      assertEquals(await entries.get(key), null);
    });
  },
);
