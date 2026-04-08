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

describe("LedgerEntries key builders", () => {
  it("covers non-default builder branches", () => {
    const rawBytes = xdr.ScVal.scvU32(7).toXDR();
    const rawString = Array.from(
      rawBytes,
      (byte) => String.fromCharCode(byte),
    ).join("");

    const temporaryKey = buildContractDataLedgerKey({
      contractId: CONTRACT_ID,
      durability: "temporary",
      key: {
        toXDR: () => rawString,
      },
    });
    const bytesKey = buildContractDataLedgerKey({
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
});
