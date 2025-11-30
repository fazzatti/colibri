import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isStellarAssetCanonicalString,
  parseStellarAssetCanonicalString,
  isNativeStellarAssetCanonicalString,
  toStellarAssetCanonicalString,
} from "@/asset//sep11/index.ts";
import type { StellarAssetCanonicalString } from "@/asset//sep11/types.ts";

describe("StellarAssetCanonicalString", () => {
  describe("isStellarAssetCanonicalString", () => {
    it("should return true for native", () => {
      assertEquals(isStellarAssetCanonicalString("native"), true);
    });

    it("should return true for valid CODE:ISSUER format", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        true
      );
    });

    it("should return true for 4 character code", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE"
        ),
        true
      );
    });

    it("should return true for 12 character code", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "ABCDEFGHIJKL:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        true
      );
    });

    it("should return true for 1 character code", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "X:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        true
      );
    });

    it("should return false for code longer than 12 characters", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "ABCDEFGHIJKLM:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });

    it("should return false for empty code", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          ":GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });

    it("should return false for invalid issuer", () => {
      assertEquals(isStellarAssetCanonicalString("USDC:INVALID"), false);
    });

    it("should return false for missing colon", () => {
      assertEquals(isStellarAssetCanonicalString("USDC"), false);
    });

    it("should return false for multiple colons", () => {
      assertEquals(isStellarAssetCanonicalString("USDC:ABC:DEF"), false);
    });

    it("should return false for non-string values", () => {
      assertEquals(isStellarAssetCanonicalString(123), false);
      assertEquals(isStellarAssetCanonicalString(null), false);
      assertEquals(isStellarAssetCanonicalString(undefined), false);
      assertEquals(isStellarAssetCanonicalString({}), false);
    });

    it("should return false for non-alphanumeric code", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "USD-C:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
      assertEquals(
        isStellarAssetCanonicalString(
          "USD C:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });

    it("should return false for contract ID as issuer", () => {
      assertEquals(
        isStellarAssetCanonicalString(
          "USDC:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
        ),
        false
      );
    });
  });

  describe("parseStellarAssetCanonicalString", () => {
    it("should parse native asset", () => {
      const result = parseStellarAssetCanonicalString("native");
      assertEquals(result.code, "XLM");
      assertEquals(result.issuer, undefined);
    });

    it("should parse issued asset", () => {
      const result = parseStellarAssetCanonicalString(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      );
      assertEquals(result.code, "USDC");
      assertEquals(
        result.issuer,
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      );
    });

    it("should parse 12 character code", () => {
      const result = parseStellarAssetCanonicalString(
        "ABCDEFGHIJKL:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" as StellarAssetCanonicalString
      );
      assertEquals(result.code, "ABCDEFGHIJKL");
    });
  });

  describe("isNativeStellarAssetCanonicalString", () => {
    it("should return true for native", () => {
      assertEquals(isNativeStellarAssetCanonicalString("native"), true);
    });

    it("should return false for issued asset", () => {
      assertEquals(
        isNativeStellarAssetCanonicalString(
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });
  });

  describe("toStellarAssetCanonicalString", () => {
    it("should return native for XLM", () => {
      assertEquals(toStellarAssetCanonicalString("XLM"), "native");
    });

    it("should return native for native", () => {
      assertEquals(toStellarAssetCanonicalString("native"), "native");
    });

    it("should return CODE:ISSUER for issued asset", () => {
      assertEquals(
        toStellarAssetCanonicalString(
          "USDC",
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      );
    });

    it("should throw when issuer is missing for non-native asset", () => {
      assertThrows(
        () => toStellarAssetCanonicalString("USDC"),
        Error,
        "Issuer required for non-native asset: USDC"
      );
    });

    it("should throw when issuer is empty string for non-native asset", () => {
      assertThrows(
        () => toStellarAssetCanonicalString("USDC", ""),
        Error,
        "Issuer required for non-native asset: USDC"
      );
    });
  });
});
