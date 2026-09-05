import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  MuxedAccount,
  Operation,
  TransactionBuilder,
  type xdr,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { StellarTestLedger } from "@colibri/test-tooling";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import {
  buildAccountLedgerKey,
  LedgerEntries,
} from "@/ledger-entries/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import { wrapSponsorship } from "@/sponsorship/index.ts";
import { SignEnvelopeErrors } from "@/processes/sign-envelope/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";

describe("reserve sponsorship on Quickstart", disableSanitizeConfig, () => {
  const ledger = new StellarTestLedger({
    containerName: `colibri-sponsorship-${crypto.randomUUID()}`,
    containerImageVersion: "testing",
    logLevel: "silent",
  });
  const sponsor = LocalSigner.generateRandom();
  const holder = LocalSigner.generateRandom();
  const asset = new Asset("SPONSORED", sponsor.publicKey());
  let rpc: Server;
  let networkConfig: NetworkConfig;
  let execute: ReturnType<typeof createClassicTransactionPipeline>;
  let config: TransactionConfig;

  const accountEntry = async (
    accountId: Ed25519PublicKey,
  ): Promise<xdr.AccountEntry> => {
    const result = await rpc.getLedgerEntries(
      buildAccountLedgerKey({ accountId }),
    );
    const value = result.entries[0].val;
    assert(value.type === "account");
    return value.account;
  };
  const reserves = (account: xdr.AccountEntry) => {
    assert(account.ext.type === "v1");
    assert(account.ext.v1.ext.type === "v2");
    return account.ext.v1.ext.v2;
  };

  beforeAll(async () => {
    await ledger.start();
    networkConfig = NetworkConfig.CustomNet(
      await ledger.getNetworkConfiguration(),
    );
    rpc = new Server(networkConfig.rpcUrl!, { allowHttp: true });
    await initializeWithFriendbot(
      networkConfig.friendbotUrl!,
      sponsor.publicKey(),
      { rpcUrl: networkConfig.rpcUrl!, allowHttp: true },
    );
    execute = createClassicTransactionPipeline({ networkConfig });
    config = {
      source: sponsor.publicKey(),
      signers: [sponsor, holder],
      fee: "100",
      timeout: 60,
    };
  });
  afterAll(async () => {
    await ledger.stop();
    await ledger.destroy();
  });

  it("creates a zero-balance sponsored account with both native signatures", async () => {
    const operations = wrapSponsorship({
      sponsor: sponsor.publicKey(),
      sponsored: holder.publicKey(),
      operations: [
        Operation.createAccount({
          destination: holder.publicKey(),
          startingBalance: "0",
        }),
      ],
    });
    const result = await execute({ operations, config });
    assertEquals(result.operations.map((op) => op.type), [
      "beginSponsoringFutureReserves",
      "createAccount",
      "endSponsoringFutureReserves",
    ]);
    const tx = TransactionBuilder.fromXdr(
      result.response.envelopeXdr.toXdr("base64"),
      networkConfig.networkPassphrase,
    );
    assertEquals(tx.signatures.length, 2);
    assertEquals(tx.fee, "300");
    assertEquals(result.feeCharged, 300n);
    const created = await accountEntry(holder.publicKey());
    assertEquals(created.balance, 0n);
    assertEquals(reserves(created).numSponsored, 2);
    assertEquals(
      reserves(await accountEntry(sponsor.publicKey())).numSponsoring,
      2,
    );
  });

  it("sponsors a trustline and data entry using an explicit muxed sponsor", async () => {
    const muxed = new MuxedAccount(new Account(sponsor.publicKey(), "0"), "33")
      .accountId() as MuxedAddress;
    const operations = wrapSponsorship({
      sponsor: muxed,
      sponsored: holder.publicKey(),
      operations: [
        Operation.changeTrust({
          source: holder.publicKey(),
          asset,
          limit: "1000",
        }),
        Operation.manageData({
          source: holder.publicKey(),
          name: "sponsored",
          value: "yes",
        }),
      ],
    });
    const result = await execute({ operations, config });
    assertEquals(result.operations.length, 4);
    const created = await accountEntry(holder.publicKey());
    assertEquals(created.balance, 0n);
    assertEquals(reserves(created).numSponsored, 4);
    assertEquals(
      reserves(await accountEntry(sponsor.publicKey())).numSponsoring,
      4,
    );
    const entries = new LedgerEntries({ rpc });
    assertEquals(
      (await entries.trustline({ accountId: holder.publicKey(), asset })).limit,
      10_000_000_000n,
    );
    assertEquals(
      (await entries.data({
        accountId: holder.publicKey(),
        dataName: "sponsored",
      })).dataValue,
      new TextEncoder().encode("yes"),
    );
  });

  it("requires the sponsored signature and leaves reserves unchanged on failure", async () => {
    await assertRejects(() =>
      execute({
        operations: wrapSponsorship({
          sponsor: sponsor.publicKey(),
          sponsored: holder.publicKey(),
          operations: [
            Operation.manageData({
              source: holder.publicKey(),
              name: "missing-signer",
              value: "no",
            }),
          ],
        }),
        config: { ...config, signers: [sponsor] },
      }), SignEnvelopeErrors.SIGNER_NOT_FOUND);
    assertEquals(
      reserves(await accountEntry(holder.publicKey())).numSponsored,
      4,
    );
  });

  it("uses ordinary native removal operations to release the sponsored subentry reserves", async () => {
    await execute({
      operations: [
        Operation.changeTrust({
          source: holder.publicKey(),
          asset,
          limit: "0",
        }),
        Operation.manageData({
          source: holder.publicKey(),
          name: "sponsored",
          value: null,
        }),
      ],
      config,
    });
    assertEquals(
      reserves(await accountEntry(holder.publicKey())).numSponsored,
      2,
    );
    assertEquals(
      reserves(await accountEntry(sponsor.publicKey())).numSponsoring,
      2,
    );
  });
});
