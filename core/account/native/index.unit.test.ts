import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset, Keypair, xdr } from "stellar-sdk";
import { NativeAccount } from "@/account/native/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import type { MuxedId, WithSigner } from "@/account/native/types.ts";
import * as E from "@/account/native/error.ts";

describe("NativeAccount", () => {
  const TEST_ADDRESS =
    "GAA2CTTAU36PSQZI2QX2FZ2AVJEFSJSOYDQ4CJ35NKSRHXVBTZWYAMSZ" as Ed25519PublicKey;
  const INVALID_ADDRESS = "INVALID_ADDRESS";
  const TEST_SECRET =
    "SC3DH36U5MAMSKENSVWSCVOXKCAEWX7EEHR347PJNHMMQDXRBSZ3PRCJ";

  describe("fromAddress", () => {
    it("creates an account from a valid Ed25519 public key", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);

      assertExists(account);
      assertEquals(account.address(), TEST_ADDRESS);
    });

    it("throws on invalid Ed25519 public key", () => {
      assertThrows(
        () => NativeAccount.fromAddress(INVALID_ADDRESS as Ed25519PublicKey),
        E.INVALID_ED25519_PUBLIC_KEY
      );
    });

    it("throws on muxed address instead of Ed25519", () => {
      const muxedAddr =
        "MAAAAAAAAAAAAJURAAB2X52XFQP6FBXLGT6LWOOWMEXWHEWBDVRZ7V5WH34Y22MPFBHUHY" as Ed25519PublicKey;

      assertThrows(
        () => NativeAccount.fromAddress(muxedAddr),
        E.INVALID_ED25519_PUBLIC_KEY
      );
    });
  });

  describe("fromMasterSigner", () => {
    it("creates an account with master signer from signer's public key", () => {
      const signer = LocalSigner.fromSecret(TEST_SECRET);
      const account = NativeAccount.fromMasterSigner(signer);

      assertEquals(account.address(), signer.publicKey());
      assertEquals(account.signer(), signer);
    });
  });

  describe("muxedAddress", () => {
    it("generates a valid muxed address", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const muxed = account.muxedAddress("12345" as MuxedId);

      assert(muxed.startsWith("M"));
    });

    it("generates different muxed addresses for different IDs", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const muxed1 = account.muxedAddress("123" as MuxedId);
      const muxed2 = account.muxedAddress("456" as MuxedId);

      assert(muxed1 !== muxed2);
    });

    it("throws on invalid muxed ID format", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);

      assertThrows(
        () => account.muxedAddress("not-a-number" as MuxedId),
        E.INVALID_MUXED_ID
      );
    });

    it("throws on negative muxed ID", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);

      assertThrows(
        () => account.muxedAddress("-123" as MuxedId),
        E.INVALID_MUXED_ID
      );
    });

    it("accepts zero as muxed ID", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const muxed = account.muxedAddress("0" as MuxedId);

      assert(muxed.startsWith("M"));
    });
  });

  describe("getAccountLedgerKey", () => {
    it("returns account ledger key with correct type and account ID", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const ledgerKey = account.getAccountLedgerKey();

      assertEquals(ledgerKey.switch(), xdr.LedgerEntryType.account());

      const accountId = ledgerKey.account()?.accountId();
      const expectedPublicKey =
        Keypair.fromPublicKey(TEST_ADDRESS).xdrPublicKey();
      assertEquals(accountId?.toXDR(), expectedPublicKey.toXDR());
    });
  });

  describe("getTrustlineLedgerKey", () => {
    it("returns trustline ledger key for custom asset with correct account ID", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const issuer = Keypair.random().publicKey();
      const asset = new Asset("USD", issuer);
      const ledgerKey = account.getTrustlineLedgerKey(asset);

      assertEquals(ledgerKey.switch(), xdr.LedgerEntryType.trustline());

      const accountId = ledgerKey.trustLine()?.accountId();
      const expectedAccountId =
        Keypair.fromPublicKey(TEST_ADDRESS).xdrAccountId();
      assertEquals(accountId?.toXDR(), expectedAccountId.toXDR());
    });

    it("generates different keys for different assets", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const issuer = Keypair.random().publicKey();
      const asset1 = new Asset("USD", issuer);
      const asset2 = new Asset("EUR", issuer);

      const key1 = account.getTrustlineLedgerKey(asset1);
      const key2 = account.getTrustlineLedgerKey(asset2);

      assert(key1.toXDR().toString() !== key2.toXDR().toString());
    });
  });

  describe("withMasterSigner", () => {
    it("attaches a signer to the account", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);
      const signer = LocalSigner.fromSecret(TEST_SECRET);

      const accountWithSigner = account.withMasterSigner(signer);

      assertEquals(accountWithSigner.signer(), signer);
      assertEquals(accountWithSigner.address(), TEST_ADDRESS);
    });
  });

  describe("signer", () => {
    it("throws when no signer is attached", () => {
      const account = NativeAccount.fromAddress(
        TEST_ADDRESS
      ) as unknown as WithSigner<NativeAccount>;

      assertThrows(() => account.signer(), E.MISSING_MASTER_SIGNER);
    });
  });

  describe("integration", () => {
    it("account without signer can use non-signer methods", () => {
      const account = NativeAccount.fromAddress(TEST_ADDRESS);

      // These should work
      assertExists(account.address());
      assertExists(account.muxedAddress("200" as MuxedId));
      assertExists(account.getAccountLedgerKey());
      assertExists(account.getTrustlineLedgerKey(Asset.native()));

      // Only signer() should throw
      assertThrows(
        () => (account as WithSigner<NativeAccount>).signer(),
        E.MISSING_MASTER_SIGNER
      );
    });
  });
});
