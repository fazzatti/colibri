import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  AuthClawbackEnabledFlag,
  AuthRequiredFlag,
  AuthRevocableFlag,
  Claimant,
  FeeBumpTransaction,
  Memo,
  MuxedAccount,
  Operation,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { StellarTestLedger } from "@colibri/test-tooling";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import {
  createSep29Plugin,
  SEP29_MEMO_REQUIRED_DATA_NAME,
  Sep29Errors,
} from "@colibri/plugin-sep29";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { StellarAsset } from "@/asset/stellar/index.ts";
import { StellarAssetContract } from "@/asset/sac/index.ts";
import {
  AUTHORIZATION_TRUSTLINE_MISSING,
  BALANCE_TRUSTLINE_MISSING,
  ISSUER_BALANCE_UNDEFINED,
} from "@/asset/stellar/error.ts";
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

    it("executes every issued-asset action with constructor channel and fee-bump plugins plus memo", async () => {
      const token = StellarAsset.fromCanonical({
        canonical: `PLUG:${issuer.publicKey()}`,
        networkConfig,
        plugins: {
          transactionPipe: [
            createChannelAccountsPlugin({
              channels: [NativeAccount.fromMasterSigner(channel)],
            }),
            createFeeBumpPlugin({
              networkConfig,
              feeBumpConfig: {
                source: recipient.publicKey(),
                signers: [recipient],
                fee: "200",
              },
            }),
          ],
        },
      });
      const actions: [() => Promise<ClassicTransactionOutput>, LocalSigner][] =
        [
          [
            () => token.changeTrust({ limit: "10", config: configFor(holder) }),
            holder,
          ],
          [
            () =>
              token.setTrustLineFlags({
                trustor: holder.publicKey(),
                flags: { authorized: true },
                config: configFor(issuer),
              }),
            issuer,
          ],
          [
            () =>
              token.mint({
                destination: holder.publicKey(),
                amount: "3",
                config: configFor(issuer),
              }),
            issuer,
          ],
          [
            () =>
              token.setAuthorized({
                id: holder.publicKey(),
                authorize: false,
                config: configFor(issuer),
              }),
            issuer,
          ],
          [
            () =>
              token.setAuthorized({
                id: holder.publicKey(),
                authorize: true,
                config: configFor(issuer),
              }),
            issuer,
          ],
          [
            () =>
              token.clawback({
                from: holder.publicKey(),
                amount: "1",
                config: configFor(issuer),
              }),
            issuer,
          ],
          [
            () => token.burn({ amount: "2", config: configFor(holder) }),
            holder,
          ],
          [
            () => token.changeTrust({ limit: "0", config: configFor(holder) }),
            holder,
          ],
        ];
      for (const [action, operationSigner] of actions) {
        const result = await action();
        const native = TransactionBuilder.fromXdr(
          result.response.envelopeXdr.toXdr("base64"),
          networkConfig.networkPassphrase,
        );
        assert(native instanceof FeeBumpTransaction);
        assertEquals(native.feeSource, recipient.publicKey());
        assertEquals(native.innerTransaction.source, channel.publicKey());
        assertEquals(
          native.innerTransaction.operations[0].source,
          operationSigner.publicKey(),
        );
        assertEquals(
          native.innerTransaction.memo.value,
          new TextEncoder().encode("asset workflow"),
        );
        assertEquals(native.innerTransaction.fee, "100");
        assertEquals(result.operations.length, 1);
        assert(result.feeCharged > 0n);
      }
      assertEquals(await token.getTrustline(holder.publicKey()), null);
      assertEquals(token.transactionPipe.plugins.length, 2);
      assertEquals(token.toContract().contract.invokePipe.plugins.length, 0);
    });

    it("enforces SEP-29 with channel accounts and fee bumps on the asset pipeline", async () => {
      const memoRecipient = LocalSigner.generateRandom();
      await execute({
        operations: [
          Operation.createAccount({
            destination: memoRecipient.publicKey(),
            startingBalance: "10",
          }),
          Operation.manageData({
            source: memoRecipient.publicKey(),
            name: SEP29_MEMO_REQUIRED_DATA_NAME,
            value: "1",
          }),
        ],
        config: { ...configFor(holder), signers: [holder, memoRecipient] },
      });
      const xlm = StellarAsset.NativeXLM({
        networkConfig,
        plugins: {
          transactionPipe: [
            createChannelAccountsPlugin({
              channels: [NativeAccount.fromMasterSigner(channel)],
            }),
            createFeeBumpPlugin({
              networkConfig,
              feeBumpConfig: {
                source: recipient.publicKey(),
                signers: [recipient],
                fee: "200",
              },
            }),
            createSep29Plugin(),
          ],
        },
      });
      const payment = { destination: memoRecipient.publicKey(), amount: "1" };
      await assertRejects(
        () =>
          xlm.transfer({
            ...payment,
            config: { ...configFor(holder), memo: Memo.none() },
          }),
        Sep29Errors.MEMO_REQUIRED,
      );
      const result = await xlm.transfer({
        ...payment,
        config: { ...configFor(holder), memo: Memo.id("29") },
      });
      const native = TransactionBuilder.fromXdr(
        result.response.envelopeXdr,
        networkConfig.networkPassphrase,
      );
      assert(native instanceof FeeBumpTransaction);
      assertEquals(native.feeSource, recipient.publicKey());
      assertEquals(native.innerTransaction.source, channel.publicKey());
      assertEquals(
        native.innerTransaction.operations[0].source,
        holder.publicKey(),
      );
      assertEquals(native.innerTransaction.memo.value, "29");
      assertEquals(
        await xlm.balance({ id: memoRecipient.publicKey() }),
        110_000_000n,
      );
    });

    it("preserves every native memo variant through a fee bump on XLM transfers", async () => {
      const token = StellarAsset.NativeXLM({
        networkConfig,
        plugins: {
          transactionPipe: [
            createFeeBumpPlugin({
              networkConfig,
              feeBumpConfig: {
                source: recipient.publicKey(),
                signers: [recipient],
                fee: "200",
              },
            }),
          ],
        },
      });
      for (
        const memo of [
          Memo.none(),
          Memo.text("payment"),
          Memo.id("42"),
          Memo.hash(new Uint8Array(32).fill(1)),
          Memo.return(new Uint8Array(32).fill(2)),
        ]
      ) {
        const result = await token.transfer({
          destination: recipient.publicKey(),
          amount: "0.0000001",
          config: { ...configFor(holder), memo },
        });
        const envelope = result.response.envelopeXdr;
        assert(envelope.type === "envelopeTypeTxFeeBump");
        assertEquals(
          envelope.feeBump.tx.innerTx.v1.tx.memo.toXdr("base64"),
          memo.toXdrObject().toXdr("base64"),
        );
      }
    });

    it("reads exact balances and authorization and explicitly bridges native holdings to SAC reads", async () => {
      const token = new StellarAsset({
        code: "BRIDGE",
        issuer: issuer.publicKey(),
        networkConfig,
      });
      await assertRejects(
        () => token.balance({ id: recipient.publicKey() }),
        BALANCE_TRUSTLINE_MISSING,
      );
      await assertRejects(
        () => token.balance({ id: issuer.publicKey() }),
        ISSUER_BALANCE_UNDEFINED,
      );
      await token.changeTrust({ limit: "100", config: configFor(recipient) });
      assertEquals(await token.balance({ id: recipient.publicKey() }), 0n);
      assertEquals(
        await token.authorized({ id: recipient.publicKey() }),
        false,
      );
      await token.setTrustLineFlags({
        trustor: recipient.publicKey(),
        flags: { authorized: true },
        config: configFor(issuer),
      });
      assertEquals(await token.authorized({ id: recipient.publicKey() }), true);
      const issued = await token.mint({
        destination: recipient.publicKey(),
        amount: "12.3456789",
        config: { ...configFor(channel), signers: [channel, issuer] },
      });
      assertSubmittedOperation(
        issued,
        Operation.payment({
          asset: token.asset,
          destination: recipient.publicKey(),
          source: issuer.publicKey(),
          amount: "12.3456789",
        }),
      );
      assertEquals(
        await token.balance({ id: recipient.publicKey() }),
        123_456_789n,
      );
      const holding = await token.getTrustline(recipient.publicKey());
      assert(holding);
      assertEquals(holding.type, "trustline");
      const sac = token.toContract();
      // SAC deployment is explicitly Soroban; unlike native payments it has no memo.
      await StellarAssetContract.deploy({
        asset: token.asset,
        networkConfig,
        config: { ...configFor(issuer), memo: undefined },
      });
      assertEquals(
        await sac.balance({ id: recipient.publicKey() }),
        await token.balance({ id: recipient.publicKey() }),
      );
      const redeemed = await token.burn({
        amount: "12.3456789",
        config: configFor(recipient),
      });
      assertSubmittedOperation(
        redeemed,
        Operation.payment({
          asset: token.asset,
          destination: issuer.publicKey(),
          source: recipient.publicKey(),
          amount: "12.3456789",
        }),
      );
      assertEquals(await token.balance({ id: recipient.publicKey() }), 0n);
      const xlm = StellarAsset.NativeXLM({ networkConfig });
      assertEquals(
        await xlm.balance({ id: recipient.publicKey() }),
        (await entries.account({ accountId: recipient.publicKey() })).balance,
      );
      assertEquals(await xlm.authorized({ id: recipient.publicKey() }), true);
    });

    it("executes granular trustline, authorization, mint, clawback, burn, and removal actions", async () => {
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

    it("grants and revokes transfer authorization without upgrading unauthorized holders or removing liabilities", async () => {
      const token = new StellarAsset({
        code: "AUTH",
        issuer: issuer.publicKey(),
        networkConfig,
      });
      const revoke = () =>
        token.setAuthorized({
          id: holder.publicKey(),
          authorize: false,
          config: { ...configFor(channel), signers: [channel, issuer] },
        });
      await assertRejects(revoke, AUTHORIZATION_TRUSTLINE_MISSING);
      await token.changeTrust({ config: configFor(holder) });
      await revoke();
      let trustline = await token.getTrustline(holder.publicKey());
      assert(trustline);
      assertEquals(trustline.flags.authorized, false);
      assertEquals(trustline.flags.authorizedToMaintainLiabilities, false);
      const grant = () =>
        token.setAuthorized({
          id: holder.publicKey(),
          authorize: true,
          config: { ...configFor(channel), signers: [channel, issuer] },
        });
      const granted = await grant();
      assertSubmittedOperation(
        granted,
        Operation.setTrustLineFlags({
          asset: token.asset,
          source: issuer.publicKey(),
          trustor: holder.publicKey(),
          flags: { authorized: true, authorizedToMaintainLiabilities: false },
        }),
      );
      await token.mint({
        destination: holder.publicKey(),
        amount: "10",
        config: configFor(issuer),
      });
      await execute({
        operations: [Operation.manageSellOffer({
          selling: token.asset,
          buying: Asset.native(),
          amount: "1",
          price: "2",
        })],
        config: configFor(holder),
      });
      const before = await token.getTrustline(holder.publicKey());
      assert(before);
      assert(before.liabilities);
      assertEquals(before.liabilities.selling, 10_000_000n);
      const revoked = await revoke();
      assertSubmittedOperation(
        revoked,
        Operation.setTrustLineFlags({
          asset: token.asset,
          source: issuer.publicKey(),
          trustor: holder.publicKey(),
          flags: { authorized: false, authorizedToMaintainLiabilities: true },
        }),
      );
      assertEquals(await token.authorized({ id: holder.publicKey() }), false);
      trustline = await token.getTrustline(holder.publicKey());
      assert(trustline);
      assertEquals(trustline.liabilities, before.liabilities);
      assertEquals(
        trustline.flags.clawbackEnabled,
        before.flags.clawbackEnabled,
      );
      await assertRejects(
        () => token.burn({ amount: "1", config: configFor(holder) }),
        ColibriError,
      );
      await revoke();
      assertEquals(
        (await token.getTrustline(holder.publicKey()))?.flags
          .authorizedToMaintainLiabilities,
        true,
      );
      await grant();
      assertEquals(await token.authorized({ id: holder.publicKey() }), true);
      assertEquals(
        (await token.getTrustline(holder.publicKey()))?.flags
          .authorizedToMaintainLiabilities,
        false,
      );
      await token.burn({ amount: "1", config: configFor(holder) });
    });

    it("creates and claims issued and native balances with channel, fee-bump and memo plugins", async () => {
      for (
        const asset of [new Asset("CLAIM", issuer.publicKey()), Asset.native()]
      ) {
        const token = new StellarAsset({
          asset,
          networkConfig,
          plugins: {
            transactionPipe: [
              createChannelAccountsPlugin({
                channels: [NativeAccount.fromMasterSigner(channel)],
              }),
              createFeeBumpPlugin({
                networkConfig,
                feeBumpConfig: {
                  source: recipient.publicKey(),
                  signers: [recipient],
                  fee: "200",
                },
              }),
              createSep29Plugin(),
            ],
          },
        });
        if (!token.isNative()) {
          for (const signer of [holder, recipient]) {
            await token.changeTrust({ config: configFor(signer) });
            await token.setAuthorized({
              id: signer.publicKey(),
              authorize: true,
              config: configFor(issuer),
            });
          }
          await token.mint({
            destination: holder.publicKey(),
            amount: "2",
            config: configFor(issuer),
          });
        }
        const claimants = [
          new Claimant(recipient.publicKey(), P.unconditional()),
        ];
        // Explicit source differs from config.source as well as the plugin's channel.
        const creation = await token.createClaimableBalance({
          amount: "2",
          claimants,
          source: holder.publicKey(),
          config: { ...configFor(issuer), signers: [issuer, holder] },
        });
        const native = TransactionBuilder.fromXdr(
          creation.response.envelopeXdr,
          networkConfig.networkPassphrase,
        );
        assert(native instanceof FeeBumpTransaction);
        assertEquals(native.feeSource, recipient.publicKey());
        assertEquals(native.innerTransaction.source, channel.publicKey());
        assertEquals(
          native.innerTransaction.memo.value,
          new TextEncoder().encode("asset workflow"),
        );
        assertEquals(native.innerTransaction.operations, [
          Operation.fromXdrObject(Operation.createClaimableBalance({
            asset,
            amount: "2",
            claimants,
            source: holder.publicKey(),
          })),
        ]);
        const outcome = creation.operations[0];
        assert(outcome.type === "createClaimableBalance");
        const balanceId = outcome.result.balanceId;
        const strkeyBytes = new Uint8Array(33);
        strkeyBytes.set(balanceId.v0.toBytes(), 1);
        const key = buildClaimableBalanceLedgerKey({
          balanceId: StrKey.encodeClaimableBalance(strkeyBytes),
        });
        const stored = await entries.get(key);
        assert(stored);
        assertEquals(stored.amount, 20_000_000n);
        const claimed = await execute({
          operations: [
            Operation.claimClaimableBalance({
              balanceId: balanceId.toXdr("hex"),
            }),
          ],
          config: configFor(recipient),
        });
        assertEquals(claimed.operations[0].type, "claimClaimableBalance");
        assertEquals(await entries.get(key), null);
        if (!token.isNative()) {
          assertEquals(await token.balance({ id: holder.publicKey() }), 0n);
          assertEquals(
            await token.balance({ id: recipient.publicKey() }),
            20_000_000n,
          );
        }
      }
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
