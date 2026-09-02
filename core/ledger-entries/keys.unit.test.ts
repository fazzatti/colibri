import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "node:buffer";
import { Keypair, xdr } from "stellar-sdk";
import type { LedgerKeyLike } from "@/common/types/index.ts";
import * as E from "@/ledger-entries/error.ts";
import {
  buildAccountLedgerKey,
  buildClaimableBalanceLedgerKey,
  buildConfigSettingLedgerKey,
  buildContractCodeLedgerKey,
  buildContractDataLedgerKey,
  buildDataLedgerKey,
  buildOfferLedgerKey,
  buildTtlLedgerKey,
  hashLedgerKey,
} from "@/ledger-entries/index.ts";
import type {
  AccountLedgerEntry,
  AccountLedgerKey,
  AnyLedgerEntry,
  EntryFromLedgerKey,
} from "@/ledger-entries/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import type {
  ClaimableBalanceId,
  ContractId,
  Ed25519PublicKey,
} from "@/strkeys/types.ts";

const ACCOUNT_ID = Keypair.random().publicKey() as Ed25519PublicKey;
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 3)) as ContractId;
const KNOWN_ISSUE_INVALID_CLAIMABLE_BALANCE_ID =
  "BAAT6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGXACA" as ClaimableBalanceId;

type Assert<T extends true> = T;
type IsEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

type _TypedAccountKeyInfersEntry = Assert<
  IsEqual<EntryFromLedgerKey<AccountLedgerKey>, AccountLedgerEntry>
>;
type _UnbrandedLedgerKeyFallsBackToUnion = Assert<
  IsEqual<EntryFromLedgerKey<xdr.LedgerKey>, AnyLedgerEntry>
>;

describe("LedgerEntries key builders", () => {
  it("covers non-default builder branches", () => {
    const rawBytes = xdr.ScVal.scvU32(7).toXdr("raw");
    const base64String = xdr.ScVal.scvU32(7).toXdr("base64");

    const temporaryKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      durability: "temporary",
      key: xdr.ScVal.fromXdr(base64String, "base64"),
    });
    const bytesKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      key: xdr.ScVal.fromXdr(rawBytes),
    });
    const rawFallbackKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      key: xdr.ScVal.scvU32(7),
    });
    const dataKey = buildDataLedgerKey({
      accountId: ACCOUNT_ID,
      dataName: new Uint8Array([1, 2, 3]),
    });
    const dataViewKey = buildDataLedgerKey({
      accountId: ACCOUNT_ID,
      dataName: new DataView(new Uint8Array([0, 4, 5, 6, 0]).buffer, 1, 3),
    });
    const codeKey = buildContractCodeLedgerKey({
      hash: new DataView(new Uint8Array(34).fill(5).buffer, 1, 32),
    });
    const ttlKey = buildTtlLedgerKey({
      keyHash: new DataView(new Uint8Array(34).fill(6).buffer, 1, 32),
    });
    const temporaryContractData = (
      temporaryKey as unknown as xdr.LedgerKeyContractDataArm
    ).contractData;
    const bytesContractData = (
      bytesKey as unknown as xdr.LedgerKeyContractDataArm
    ).contractData;
    const fallbackContractData = (
      rawFallbackKey as unknown as xdr.LedgerKeyContractDataArm
    ).contractData;

    assertEquals(
      temporaryContractData.durability.name,
      "temporary",
    );
    assertEquals(
      temporaryContractData.key.type === "scvU32"
        ? temporaryContractData.key.u32
        : undefined,
      7,
    );
    assertEquals(
      bytesContractData.key.type === "scvU32"
        ? bytesContractData.key.u32
        : undefined,
      7,
    );
    assertEquals(
      fallbackContractData.key.type === "scvU32"
        ? fallbackContractData.key.u32
        : undefined,
      7,
    );
    assertEquals(
      Buffer.from(
        (dataKey as unknown as xdr.LedgerKeyDataArm).data.dataName.bytes,
      ),
      Buffer.from([1, 2, 3]),
    );
    assertEquals(
      Buffer.from(
        (dataViewKey as unknown as xdr.LedgerKeyDataArm).data.dataName.bytes,
      ),
      Buffer.from([4, 5, 6]),
    );
    assertEquals(
      (codeKey as unknown as xdr.LedgerKeyContractCodeArm).contractCode.hash
        .toBytes().length,
      32,
    );
    assertEquals(
      (ttlKey as unknown as xdr.LedgerKeyTtlArm).ttl.keyHash.toBytes().length,
      32,
    );
  });

  it("validates claimable balance, config setting, and hash inputs", () => {
    assertThrows(
      () =>
        buildClaimableBalanceLedgerKey({
          balanceId: KNOWN_ISSUE_INVALID_CLAIMABLE_BALANCE_ID,
        }),
      E.INVALID_CLAIMABLE_BALANCE_ID,
    );

    assertThrows(
      () =>
        buildContractDataLedgerKey({
          contractId: "BAD" as ContractId,
          key: xdr.ScVal.scvU32(1),
        }),
      E.INVALID_CONTRACT_ID,
    );
    assertThrows(
      () =>
        buildConfigSettingLedgerKey({
          configSettingId: "badSetting" as never,
        }),
      E.INVALID_CONFIG_SETTING_ID,
    );
    assertThrows(
      () =>
        buildContractCodeLedgerKey({
          hash: new Uint8Array(31),
        }),
      E.INVALID_HEX_HASH,
    );
    assertThrows(
      () =>
        buildTtlLedgerKey({
          keyHash: "BAD" as never,
        }),
      E.INVALID_LEDGER_KEY_HASH,
    );
    assertThrows(
      () =>
        buildTtlLedgerKey({
          keyHash: new Uint8Array(31),
        }),
      E.INVALID_LEDGER_KEY_HASH,
    );
    assertThrows(
      () =>
        buildOfferLedgerKey({
          sellerId: ACCOUNT_ID,
          offerId: 1.5,
        }),
      E.INVALID_OFFER_ID,
    );
    assertThrows(
      () =>
        buildOfferLedgerKey({
          sellerId: ACCOUNT_ID,
          offerId: -1,
        }),
      E.INVALID_OFFER_ID,
    );
    assertThrows(
      () =>
        buildOfferLedgerKey({
          sellerId: ACCOUNT_ID,
          offerId: "not-an-int",
        }),
      E.INVALID_OFFER_ID,
    );
  });

  it("accepts string-form offer ids", () => {
    const key = buildOfferLedgerKey({
      sellerId: ACCOUNT_ID,
      offerId: "17",
    });

    assertEquals(
      (key as unknown as xdr.LedgerKeyOfferArm).offer.offerId,
      17n,
    );
  });

  it("hashes canonical SDK ledger keys", () => {
    const key = buildAccountLedgerKey({
      accountId: ACCOUNT_ID,
    });

    const hash = hashLedgerKey(key);

    assertEquals(StrKey.isSha256Hash(hash), true);
  });

  it("hashes a canonical ledger key decoded from base64 XDR", () => {
    const original = buildAccountLedgerKey({
      accountId: ACCOUNT_ID,
    });
    const key = xdr.LedgerKey.fromXdr(
      original.toXdr("base64"),
      "base64",
    ) as LedgerKeyLike;

    const hash = hashLedgerKey(key);

    assertEquals(StrKey.isSha256Hash(hash), true);
  });
});
