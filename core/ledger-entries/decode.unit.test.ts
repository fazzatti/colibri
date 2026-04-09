import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Address, Asset, Keypair, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { parseTrustLineAsset } from "@/common/helpers/xdr/parse-trustline-asset.ts";
import {
  decodeLedgerEntry,
  decodeLedgerEntryForKey,
  detectLedgerEntryKindFromKey,
} from "@/ledger-entries/decode.ts";
import * as E from "@/ledger-entries/error.ts";
import {
  buildAccountLedgerKey,
  buildClaimableBalanceLedgerKey,
  buildConfigSettingLedgerKey,
  buildContractCodeLedgerKey,
  buildContractInstanceLedgerKey,
  buildTtlLedgerKey,
  buildTrustlineLedgerKey,
} from "@/ledger-entries/index.ts";
import { StrKey } from "@/strkeys/index.ts";
import type {
  ClaimableBalanceId,
  ContractId,
  Ed25519PublicKey,
} from "@/strkeys/types.ts";

const ACCOUNT_ID = Keypair.random().publicKey() as Ed25519PublicKey;
const SECOND_ACCOUNT_ID = Keypair.random().publicKey() as Ed25519PublicKey;
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 3)) as ContractId;
const CLAIMABLE_BALANCE_ID =
  "BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU" as ClaimableBalanceId;

function makeResult(
  key: xdr.LedgerKey,
  val: xdr.LedgerEntryData,
  extras: Partial<Api.LedgerEntryResult> = {},
): Api.LedgerEntryResult {
  return {
    key,
    val,
    ...extras,
  };
}

function makeMockEntry(
  entryType: string,
  arm: string,
  payload: unknown,
  key = buildAccountLedgerKey({
    accountId: ACCOUNT_ID,
  }) as unknown as xdr.LedgerKey,
): Api.LedgerEntryResult {
  return {
    key,
    val: {
      switch: () => ({ name: entryType, value: 0 }),
      [arm]: () => payload,
    } as unknown as xdr.LedgerEntryData,
  };
}

describe("LedgerEntries decode helpers", () => {
  it("covers additional signer-key variants and account fallbacks", () => {
    const rawPublicKey = Keypair.fromPublicKey(ACCOUNT_ID).rawPublicKey();
    const signedPayload = new xdr.SignerKeyEd25519SignedPayload({
      ed25519: rawPublicKey,
      payload: Buffer.from([1, 2, 3]),
    });

    const entry = makeMockEntry("account", "account", {
      accountId: () => Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
      balance: () => xdr.Int64.fromString("50"),
      seqNum: () => xdr.Int64.fromString("9"),
      numSubEntries: () => 4,
      inflationDest: () => undefined,
      flags: () => 0,
      homeDomain: () => Buffer.from(""),
      thresholds: () => Buffer.from([]),
      signers: () => [
        {
          key: () => xdr.SignerKey.signerKeyTypeEd25519(rawPublicKey),
          weight: () => 1,
        },
        {
          key: () =>
            xdr.SignerKey.signerKeyTypePreAuthTx(
              Buffer.alloc(32, 4),
            ),
          weight: () => 2,
        },
        {
          key: () => xdr.SignerKey.signerKeyTypeHashX(Buffer.alloc(32, 5)),
          weight: () => 3,
        },
        {
          key: () =>
            xdr.SignerKey.signerKeyTypeEd25519SignedPayload(signedPayload),
          weight: () => 4,
        },
      ],
    });

    const decoded = decodeLedgerEntry(entry);

    assertEquals(decoded.type, "account");
    if (decoded.type !== "account") {
      throw new Error("expected account entry");
    }
    assertEquals(decoded.inflationDestination, undefined);
    assertEquals(decoded.thresholds.high, 0);
    assertEquals(decoded.signers[1].key.type, "preAuthTx");
    assertEquals(decoded.signers[2].key.type, "hashX");
    assertEquals(decoded.signers[3].key.type, "ed25519SignedPayload");
  });

  it("covers additional claim-predicate variants", () => {
    const destination = Keypair.fromPublicKey(SECOND_ACCOUNT_ID)
      .xdrAccountId();
    const claimants = [
      xdr.Claimant.claimantTypeV0(
        new xdr.ClaimantV0({
          destination,
          predicate: xdr.ClaimPredicate.claimPredicateUnconditional(),
        }),
      ),
      xdr.Claimant.claimantTypeV0(
        new xdr.ClaimantV0({
          destination,
          predicate: xdr.ClaimPredicate.claimPredicateAnd([
            xdr.ClaimPredicate.claimPredicateUnconditional(),
            xdr.ClaimPredicate.claimPredicateBeforeAbsoluteTime(
              xdr.Int64.fromString("123"),
            ),
          ]),
        }),
      ),
      xdr.Claimant.claimantTypeV0(
        new xdr.ClaimantV0({
          destination,
          predicate: xdr.ClaimPredicate.claimPredicateOr([
            xdr.ClaimPredicate.claimPredicateUnconditional(),
            xdr.ClaimPredicate.claimPredicateBeforeAbsoluteTime(
              xdr.Int64.fromString("456"),
            ),
          ]),
        }),
      ),
      xdr.Claimant.claimantTypeV0(
        new xdr.ClaimantV0({
          destination,
          predicate: xdr.ClaimPredicate.claimPredicateNot(
            xdr.ClaimPredicate.claimPredicateBeforeAbsoluteTime(
              xdr.Int64.fromString("789"),
            ),
          ),
        }),
      ),
      xdr.Claimant.claimantTypeV0(
        new xdr.ClaimantV0({
          destination,
          predicate: xdr.ClaimPredicate.claimPredicateBeforeRelativeTime(
            xdr.Int64.fromString("321"),
          ),
        }),
      ),
    ];
    const key = buildClaimableBalanceLedgerKey({
      balanceId: CLAIMABLE_BALANCE_ID,
    }) as unknown as xdr.LedgerKey;
    const balanceId = xdr.ClaimableBalanceId.claimableBalanceIdTypeV0(
      Buffer.from(StrKey.decodeClaimableBalance(CLAIMABLE_BALANCE_ID))
        .subarray(1),
    );
    const entry = makeResult(
      key,
      xdr.LedgerEntryData.claimableBalance(
        new xdr.ClaimableBalanceEntry({
          balanceId,
          claimants,
          asset: Asset.native().toXDRObject(),
          amount: xdr.Int64.fromString("99"),
          ext: new xdr.ClaimableBalanceEntryExt(0),
        }),
      ),
    );

    const decoded = decodeLedgerEntry(entry);

    assertEquals(decoded.type, "claimableBalance");
    if (decoded.type !== "claimableBalance") {
      throw new Error("expected claimable balance entry");
    }
    assertEquals(decoded.flags.clawbackEnabled, false);
    assertEquals(decoded.claimants[0].predicate.type, "unconditional");
    assertEquals(decoded.claimants[1].predicate.type, "and");
    assertEquals(decoded.claimants[2].predicate.type, "or");
    assertEquals(decoded.claimants[3].predicate.type, "not");
    assertEquals(decoded.claimants[4].predicate.type, "beforeRelativeTime");
  });

  it("covers nullable claim predicates", () => {
    const decoded = decodeLedgerEntry(
      makeMockEntry("claimableBalance", "claimableBalance", {
        balanceId: () => ({
          v0: () => new Uint8Array(32).fill(1),
        }),
        claimants: () => [{
          v0: () => ({
            destination: () =>
              Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
            predicate: () => ({
              switch: () => ({ name: "claimPredicateNot" }),
              notPredicate: () => null,
            }),
          }),
        }],
        asset: () => Asset.native().toXDRObject(),
        amount: () => xdr.Int64.fromString("1"),
        ext: () => ({ switch: () => 0 }),
      }),
    );

    assertEquals(decoded.type, "claimableBalance");
    if (decoded.type !== "claimableBalance") {
      throw new Error("expected claimable balance entry");
    }
    assertEquals(decoded.claimants[0].predicate.type, "not");
    if (decoded.claimants[0].predicate.type !== "not") {
      throw new Error("expected not predicate");
    }
    assertEquals(decoded.claimants[0].predicate.predicate, null);
  });

  it("covers trustline, contract code, contract instance, and config fallbacks", () => {
    const trustlineKey = buildTrustlineLedgerKey({
      accountId: ACCOUNT_ID,
      asset: Asset.native(),
    }) as unknown as xdr.LedgerKey;
    const trustlineEntry = makeResult(
      trustlineKey,
      xdr.LedgerEntryData.trustline(
        new xdr.TrustLineEntry({
          accountId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
          asset: Asset.native().toTrustLineXDRObject() as xdr.TrustLineAsset,
          balance: xdr.Int64.fromString("5"),
          limit: xdr.Int64.fromString("10"),
          flags: 0,
          ext: new xdr.TrustLineEntryExt(0),
        }),
      ),
    );
    const codeEntry = makeResult(
      buildContractCodeLedgerKey({
        hash: "cd".repeat(32),
      }) as unknown as xdr.LedgerKey,
      xdr.LedgerEntryData.contractCode(
        new xdr.ContractCodeEntry({
          hash: Buffer.from("cd".repeat(32), "hex"),
          code: Buffer.from([9, 8, 7]),
          ext: new xdr.ContractCodeEntryExt(0),
        }),
      ),
    );
    const instanceEntry = makeMockEntry(
      "contractData",
      "contractData",
      {
        contract: () => Address.fromString(CONTRACT_ID).toScAddress(),
        durability: () => xdr.ContractDataDurability.persistent(),
        key: () => xdr.ScVal.scvLedgerKeyContractInstance(),
        val: () => ({
          instance: () => ({
            executable: () =>
              xdr.ContractExecutable.contractExecutableStellarAsset(),
            storage: () => undefined,
          }),
        }),
      },
      buildContractInstanceLedgerKey({
        contractId: CONTRACT_ID,
      }) as unknown as xdr.LedgerKey,
    );
    const configEntry = makeMockEntry(
      "configSetting",
      "configSetting",
      {
        switch: () => ({ name: "configSettingStateArchival", value: 0 }),
        value: () => [
          { toBigInt: () => 1n },
          { toBigInt: () => 2n },
        ],
      },
      buildConfigSettingLedgerKey({
        configSettingId: "configSettingStateArchival",
      }) as unknown as xdr.LedgerKey,
    );

    const decodedTrustline = decodeLedgerEntry(trustlineEntry);
    const decodedCode = decodeLedgerEntry(codeEntry);
    const decodedInstance = decodeLedgerEntry(instanceEntry);
    const decodedConfig = decodeLedgerEntry(configEntry);

    assertEquals(decodedTrustline.type, "trustline");
    if (decodedTrustline.type !== "trustline") {
      throw new Error("expected trustline entry");
    }
    assertEquals(
      decodedTrustline.asset,
      parseTrustLineAsset(
        Asset.native().toTrustLineXDRObject() as xdr.TrustLineAsset,
      ),
    );
    assertEquals(decodedTrustline.liabilities, undefined);
    assertEquals(decodedCode.type, "contractCode");
    if (decodedCode.type !== "contractCode") {
      throw new Error("expected contract code entry");
    }
    assertEquals(decodedCode.costInputs, undefined);
    assertEquals(decodedInstance.type, "contractInstance");
    if (decodedInstance.type !== "contractInstance") {
      throw new Error("expected contract instance entry");
    }
    assertEquals(decodedInstance.executable.type, "stellarAsset");
    assertEquals(decodedConfig.type, "configSetting");
    if (decodedConfig.type !== "configSetting") {
      throw new Error("expected config setting entry");
    }
    assertEquals(decodedConfig.value, [1n, 2n]);
  });

  it("covers ttl key detection", () => {
    const ttlKey = buildTtlLedgerKey({
      keyHash: StrKey.encodeSha256Hash(Buffer.alloc(32, 9)),
    }) as unknown as xdr.LedgerKey;

    assertEquals(detectLedgerEntryKindFromKey(ttlKey), "ttl");
  });

  it("covers unsupported decode branches", () => {
    assertThrows(
      () =>
        decodeLedgerEntry(
          makeMockEntry("account", "account", {
            accountId: () => Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
            balance: () => xdr.Int64.fromString("1"),
            seqNum: () => xdr.Int64.fromString("1"),
            numSubEntries: () => 1,
            inflationDest: () => undefined,
            flags: () => 0,
            homeDomain: () => "",
            thresholds: () => Buffer.from([0, 0, 0, 0]),
            signers: () => [
              {
                key: () => ({
                  switch: () => ({ name: "unsupportedSignerKey" }),
                }),
                weight: () => 1,
              },
            ],
          }),
        ),
      Error,
      "Unsupported signer key type",
    );
    assertThrows(
      () =>
        decodeLedgerEntry(
          makeMockEntry("claimableBalance", "claimableBalance", {
            balanceId: () => ({
              v0: () => new Uint8Array(32).fill(1),
            }),
            claimants: () => [{
              v0: () => ({
                destination: () =>
                  Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
                predicate: () => ({
                  switch: () => ({ name: "unsupportedPredicate" }),
                }),
              }),
            }],
            asset: () => Asset.native().toXDRObject(),
            amount: () => xdr.Int64.fromString("1"),
            ext: () => ({ switch: () => 0 }),
          }),
        ),
      Error,
      "Unsupported claim predicate type",
    );
    assertThrows(
      () =>
        decodeLedgerEntry(
          makeMockEntry("contractData", "contractData", {
            contract: () => Address.fromString(CONTRACT_ID).toScAddress(),
            durability: () => xdr.ContractDataDurability.persistent(),
            key: () => xdr.ScVal.scvLedgerKeyContractInstance(),
            val: () => ({
              instance: () => ({
                executable: () => ({
                  switch: () => ({ name: "unsupportedExecutable" }),
                }),
                storage: () => [],
              }),
            }),
          }),
        ),
      Error,
      "Unsupported contract executable type",
    );
    assertThrows(
      () =>
        detectLedgerEntryKindFromKey({
          switch: () => ({ name: "unsupportedKeyType" }),
        } as unknown as xdr.LedgerKey),
      Error,
      "Unsupported ledger key type",
    );
    assertThrows(
      () =>
        decodeLedgerEntry({
          val: {
            switch: () => ({ name: "unsupportedEntryType" }),
          },
        } as unknown as Api.LedgerEntryResult),
      Error,
      "Unsupported ledger entry type",
    );
    assertThrows(
      () =>
        decodeLedgerEntryForKey(
          buildAccountLedgerKey({
            accountId: ACCOUNT_ID,
          }) as unknown as xdr.LedgerKey,
          makeMockEntry("data", "data", {
            accountId: () => Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
            dataName: () => "profile",
            dataValue: () => new Uint8Array([1]),
          }),
        ),
      E.UNEXPECTED_LEDGER_ENTRY_TYPE,
    );
  });
});
