import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isSEP11Asset,
  parseSEP11Asset,
  isNativeSEP11Asset,
  toSEP11Asset,
  type SEP11Asset,
} from "@/asset//sep11/index.ts";

describe("SEP11Asset", () => {
  describe("isSEP11Asset", () => {
    it("should return true for native", () => {
      assertEquals(isSEP11Asset("native"), true);
    });

    it("should return true for valid CODE:ISSUER format", () => {
      assertEquals(
        isSEP11Asset(
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        true
      );
    });

    it("should return true for 4 character code", () => {
      assertEquals(
        isSEP11Asset(
          "KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE"
        ),
        true
      );
    });

    it("should return true for 12 character code", () => {
      assertEquals(
        isSEP11Asset(
          "ABCDEFGHIJKL:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        true
      );
    });

    it("should return true for 1 character code", () => {
      assertEquals(
        isSEP11Asset(
          "X:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        true
      );
    });

    it("should return false for code longer than 12 characters", () => {
      assertEquals(
        isSEP11Asset(
          "ABCDEFGHIJKLM:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });

    it("should return false for empty code", () => {
      assertEquals(
        isSEP11Asset(
          ":GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });

    it("should return false for invalid issuer", () => {
      assertEquals(isSEP11Asset("USDC:INVALID"), false);
    });

    it("should return false for missing colon", () => {
      assertEquals(isSEP11Asset("USDC"), false);
    });

    it("should return false for multiple colons", () => {
      assertEquals(isSEP11Asset("USDC:ABC:DEF"), false);
    });

    it("should return false for non-string values", () => {
      assertEquals(isSEP11Asset(123), false);
      assertEquals(isSEP11Asset(null), false);
      assertEquals(isSEP11Asset(undefined), false);
      assertEquals(isSEP11Asset({}), false);
    });

    it("should return false for non-alphanumeric code", () => {
      assertEquals(
        isSEP11Asset(
          "USD-C:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
      assertEquals(
        isSEP11Asset(
          "USD C:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });

    it("should return false for contract ID as issuer", () => {
      assertEquals(
        isSEP11Asset(
          "USDC:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
        ),
        false
      );
    });
  });

  describe("parseSEP11Asset", () => {
    it("should parse native asset", () => {
      const result = parseSEP11Asset("native");
      assertEquals(result.code, "XLM");
      assertEquals(result.issuer, undefined);
    });

    it("should parse issued asset", () => {
      const result = parseSEP11Asset(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      );
      assertEquals(result.code, "USDC");
      assertEquals(
        result.issuer,
        "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      );
    });

    it("should parse 12 character code", () => {
      const result = parseSEP11Asset(
        "ABCDEFGHIJKL:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" as SEP11Asset
      );
      assertEquals(result.code, "ABCDEFGHIJKL");
    });
  });

  describe("isNativeSEP11Asset", () => {
    it("should return true for native", () => {
      assertEquals(isNativeSEP11Asset("native"), true);
    });

    it("should return false for issued asset", () => {
      assertEquals(
        isNativeSEP11Asset(
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        false
      );
    });
  });

  describe("toSEP11Asset", () => {
    it("should return native for XLM", () => {
      assertEquals(toSEP11Asset("XLM"), "native");
    });

    it("should return native for native", () => {
      assertEquals(toSEP11Asset("native"), "native");
    });

    it("should return CODE:ISSUER for issued asset", () => {
      assertEquals(
        toSEP11Asset(
          "USDC",
          "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
        ),
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
      );
    });
  });
});
