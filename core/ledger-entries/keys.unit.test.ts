import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
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
    const rawBytes = xdr.ScVal.scvU32(7).toXDR("raw");
    const base64String = xdr.ScVal.scvU32(7).toXDR("base64");
    const base64Bytes = new TextEncoder().encode(String(base64String));

    const temporaryKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      durability: "temporary",
      key: {
        toXDR: (format?: "raw" | "hex" | "base64") =>
          format === "base64" ? String(base64String) : rawBytes,
      },
    });
    const bytesKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      key: {
        toXDR: (format?: "raw" | "hex" | "base64") =>
          format === "base64" ? base64Bytes : rawBytes,
      },
    });
    const rawFallbackKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      key: {
        toXDR: () => rawBytes,
      },
    });
    const dataKey = buildDataLedgerKey({
      accountId: ACCOUNT_ID,
      dataName: new Uint8Array([1, 2, 3]),
    });
    const codeKey = buildContractCodeLedgerKey({
      hash: new Uint8Array(32).fill(5),
    });
    const ttlKey = buildTtlLedgerKey({
      keyHash: new Uint8Array(32).fill(6),
    });

    assertEquals(
      (temporaryKey as unknown as xdr.LedgerKey).contractData().durability()
        .name,
      "temporary",
    );
    assertEquals(
      (temporaryKey as unknown as xdr.LedgerKey).contractData().key().u32(),
      7,
    );
    assertEquals(
      (bytesKey as unknown as xdr.LedgerKey).contractData().key().u32(),
      7,
    );
    assertEquals(
      (rawFallbackKey as unknown as xdr.LedgerKey).contractData().key().u32(),
      7,
    );
    assertEquals(
      Buffer.from((dataKey as unknown as xdr.LedgerKey).data().dataName()),
      Buffer.from([1, 2, 3]),
    );
    assertEquals(
      (codeKey as unknown as xdr.LedgerKey).contractCode().hash().length,
      32,
    );
    assertEquals(
      (ttlKey as unknown as xdr.LedgerKey).ttl().keyHash().length,
      32,
    );
  });

  it("validates claimable balance, config setting, and hash inputs", () => {
    const originalDecodeClaimableBalance = StrKey.decodeClaimableBalance;
    try {
      StrKey.decodeClaimableBalance = () =>
        new Uint8Array([0]) as ReturnType<
          typeof StrKey.decodeClaimableBalance
        >;

      assertThrows(
        () =>
          buildClaimableBalanceLedgerKey({
            balanceId: KNOWN_ISSUE_INVALID_CLAIMABLE_BALANCE_ID,
          }),
        E.INVALID_CLAIMABLE_BALANCE_ID,
      );
    } finally {
      StrKey.decodeClaimableBalance = originalDecodeClaimableBalance;
    }

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
  });

  it("hashes ledger keys that serialize to raw bytes", () => {
    const key = buildAccountLedgerKey({
      accountId: ACCOUNT_ID,
    }) as unknown as xdr.LedgerKey & LedgerKeyLike;
    Object.defineProperty(key, "toXDR", {
      value: () => new Uint8Array([1, 2, 3, 4]),
    });

    const hash = hashLedgerKey(key);

    assertEquals(StrKey.isSha256Hash(hash), true);
  });

  it("hashes ledger keys whose base64 serialization returns bytes", () => {
    const key = buildAccountLedgerKey({
      accountId: ACCOUNT_ID,
    }) as unknown as xdr.LedgerKey & LedgerKeyLike;
    const originalToXdr = key.toXDR.bind(key);

    Object.defineProperty(key, "toXDR", {
      value: (format?: "raw" | "hex" | "base64") => {
        if (format === "base64") {
          return new TextEncoder().encode(String(originalToXdr("base64")));
        }

        return originalToXdr(format ?? "raw");
      },
    });

    const hash = hashLedgerKey(key);

    assertEquals(StrKey.isSha256Hash(hash), true);
  });
});
