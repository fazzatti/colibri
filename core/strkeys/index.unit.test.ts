import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { StrKey } from "./index.ts";
import { StrkeyPrefix, StrkeyName } from "./types.ts";

describe("StrKey", () => {
  describe("getStrkeyTypeName", () => {
    it("returns correct type name for each prefix", () => {
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.Ed25519PublicKey),
        "ed25519PublicKey"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.Ed25519SecretKey),
        "ed25519SecretKey"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.Med25519PublicKey),
        "med25519PublicKey"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.PreAuthTx),
        "preAuthTx"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.Sha256Hash),
        "sha256Hash"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.SignedPayload),
        "signedPayload"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.ContractId),
        "contract"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.LiquidityPoolId),
        "liquidityPool"
      );
      assertEquals(
        StrKey.getStrkeyTypeName(StrkeyPrefix.ClaimableBalanceId),
        "claimableBalance"
      );
    });
  });

  describe("detectStrkeyType", () => {
    it("detects G prefix (Ed25519 public key)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
        ),
        StrkeyName.G
      );
    });

    it("detects S prefix (Ed25519 secret key)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR"
        ),
        StrkeyName.S
      );
    });

    it("detects M prefix (Muxed address)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ"
        ),
        StrkeyName.M
      );
    });

    it("detects T prefix (PreAuthTx)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "TBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHXL7"
        ),
        StrkeyName.T
      );
    });

    it("detects X prefix (HashX)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "XBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWGTOG"
        ),
        StrkeyName.X
      );
    });

    it("detects P prefix (Signed payload)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IBZGM"
        ),
        StrkeyName.P
      );
    });

    it("detects C prefix (Contract)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA"
        ),
        StrkeyName.C
      );
    });

    it("detects L prefix (Liquidity pool)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN"
        ),
        StrkeyName.L
      );
    });

    it("detects B prefix (Claimable balance)", () => {
      assertEquals(
        StrKey.detectStrkeyType(
          "BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU"
        ),
        StrkeyName.B
      );
    });

    it("returns null for invalid or unknown prefix", () => {
      assertEquals(StrKey.detectStrkeyType("ZABC123"), null);
      assertEquals(StrKey.detectStrkeyType(""), null);
      assertEquals(StrKey.detectStrkeyType("123"), null);
      assertEquals(StrKey.detectStrkeyType("INVALID"), null);
    });
  });

  describe("Tier 1: Format validation (regex-based)", () => {
    describe("isEd25519PublicKey", () => {
      it("accepts valid G addresses", () => {
        assertEquals(
          StrKey.isEd25519PublicKey(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          true
        );
        assertEquals(
          StrKey.isEd25519PublicKey(
            "GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB"
          ),
          true
        );
      });

      it("rejects wrong prefix", () => {
        assertEquals(
          StrKey.isEd25519PublicKey(
            "SA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          false
        );
      });

      it("rejects invalid length", () => {
        assertEquals(StrKey.isEd25519PublicKey("GAAAAAAAACGC6"), false);
        assertEquals(
          StrKey.isEd25519PublicKey(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZA"
          ),
          false
        );
      });

      it("rejects invalid base32 characters", () => {
        assertEquals(
          StrKey.isEd25519PublicKey(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJV1G8"
          ),
          false
        );
      });
    });

    describe("isEd25519SecretKey", () => {
      it("accepts valid S addresses", () => {
        assertEquals(
          StrKey.isEd25519SecretKey(
            "SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR"
          ),
          true
        );
        assertEquals(
          StrKey.isEd25519SecretKey(
            "SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDY"
          ),
          true
        );
      });

      it("rejects wrong prefix", () => {
        assertEquals(
          StrKey.isEd25519SecretKey(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          false
        );
      });

      it("rejects invalid length", () => {
        assertEquals(StrKey.isEd25519SecretKey("SABC234567890"), false);
        assertEquals(
          StrKey.isEd25519SecretKey(
            "SAFGAMN5Z6IHVI3IVEPIILS7ITZDYSCEPLN4FN5Z3IY63DRH4CIYEV"
          ),
          false
        );
      });
    });

    describe("isMuxedAddress", () => {
      it("accepts valid M addresses", () => {
        assertEquals(
          StrKey.isMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ"
          ),
          true
        );
        assertEquals(
          StrKey.isMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK"
          ),
          true
        );
      });

      it("rejects wrong prefix", () => {
        assertEquals(
          StrKey.isMuxedAddress(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          false
        );
      });
    });

    describe("isSignedPayload", () => {
      it("accepts valid P addresses", () => {
        assertEquals(
          StrKey.isSignedPayload(
            "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IBZGM"
          ),
          true
        );
      });

      it("rejects wrong prefix", () => {
        assertEquals(
          StrKey.isSignedPayload(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          false
        );
      });
    });

    describe("isContractId", () => {
      it("accepts valid C addresses", () => {
        assertEquals(
          StrKey.isContractId(
            "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE"
          ),
          true
        );
      });

      it("rejects wrong prefix", () => {
        assertEquals(
          StrKey.isContractId(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          false
        );
      });
    });

    describe("isLiquidityPoolId", () => {
      it("accepts valid L addresses", () => {
        assertEquals(
          StrKey.isLiquidityPoolId(
            "LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN"
          ),
          true
        );
      });
    });

    describe("isClaimableBalanceId", () => {
      it("accepts valid B addresses", () => {
        assertEquals(
          StrKey.isClaimableBalanceId(
            "BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU"
          ),
          true
        );
      });
    });
  });

  describe("Tier 2: Full validation (checksum & structure)", () => {
    describe("Valid addresses from SEP-23 & Stellar SDK", () => {
      it("validates Ed25519 public keys", () => {
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ"
          ),
          true
        );
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB"
          ),
          true
        );
      });

      it("validates Ed25519 secret keys", () => {
        assertEquals(
          StrKey.isValidEd25519SecretSeed(
            "SBU2RRGLXH3E5CQHTD3ODLDF2BWDCYUSSBLLZ5GNW7JXHDIYKXZWHOKR"
          ),
          true
        );
        assertEquals(
          StrKey.isValidEd25519SecretSeed(
            "SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDY"
          ),
          true
        );
      });

      it("validates muxed addresses", () => {
        assertEquals(
          StrKey.isValidMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ"
          ),
          true
        );
        assertEquals(
          StrKey.isValidMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK"
          ),
          true
        );
      });

      it("validates signed payloads", () => {
        assertEquals(
          StrKey.isValidSignedPayload(
            "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IBZGM"
          ),
          true
        );
        assertEquals(
          StrKey.isValidSignedPayload(
            "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUAAAAFGBU"
          ),
          true
        );
      });

      it("validates contracts", () => {
        assertEquals(
          StrKey.isValidContractId(
            "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE"
          ),
          true
        );
      });

      it("validates liquidity pools", () => {
        assertEquals(
          StrKey.isValidLiquidityPoolId(
            "LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN"
          ),
          true
        );
      });

      it("validates claimable balances", () => {
        assertEquals(
          StrKey.isValidClaimableBalanceId(
            "BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU"
          ),
          true
        );
      });
    });

    describe("Invalid addresses from SEP-23 (covered by Stellar SDK)", () => {
      it("rejects unused trailing bit not zero", () => {
        assertEquals(
          StrKey.isValidMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUR"
          ),
          false
        );
      });

      it("rejects invalid length (congruent to 1 mod 8)", () => {
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZA"
          ),
          false
        );
      });

      it("rejects invalid algorithm (low 3 bits are 7)", () => {
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "G47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVP2I"
          ),
          false
        );
        assertEquals(
          StrKey.isValidMuxedAddress(
            "M47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ"
          ),
          false
        );
      });

      it("rejects padding bytes", () => {
        assertEquals(
          StrKey.isValidMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUK==="
          ),
          false
        );
      });

      it("rejects invalid checksum", () => {
        assertEquals(
          StrKey.isValidMuxedAddress(
            "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUO"
          ),
          false
        );
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "GBPXXOA5N4JYPESHAADMQKBPWZWQDQ64ZV6ZL2S3LAGW4SY7NTCMWIVT"
          ),
          false
        );
      });

      it("rejects trailing bits not zero for claimable balance", () => {
        assertEquals(
          StrKey.isValidClaimableBalanceId(
            "BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TV"
          ),
          false
        );
      });
    });

    it("rejects Ed25519 with invalid decoded length (5 bytes not 32)", () => {
      assertEquals(StrKey.isValidEd25519PublicKey("GAAAAAAAACGC6"), false);
    });

    it("rejects base-32 yielding wrong byte count (36 not 35)", () => {
      assertEquals(
        StrKey.isValidEd25519PublicKey(
          "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUACUSI"
        ),
        false
      );
    });

    it("rejects muxed with wrong decoded byte count (44 not 43)", () => {
      assertEquals(
        StrKey.isValidMuxedAddress(
          "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAAV75I"
        ),
        false
      );
    });

    describe("Invalid addresses from SEP-23 (NOT covered by Stellar SDK)", () => {
      // ⚠️ The following tests document known limitations in the Stellar SDK's validation.
      // Tests prefixed with [KNOWN-ISSUE] expect the buggy behavior (returns true when it should return false).
      // The correct expected behavior is commented above each assertion.
      // TODO: Update these tests when Stellar SDK fixes these validation gaps.
      // Refer to : https://github.com/stellar/js-stellar-base/blob/5bac0b60bcd01794bb0b11fd8b6a45e486c28626/test/unit/strkey_test.js#L471

      it("[KNOWN-ISSUE] reject signed payload with length prefix shorter than payload", () => {
        // Expected: false (length prefix declares fewer bytes than actual payload)
        assertEquals(
          StrKey.isValidSignedPayload(
            "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IAAAAAAAAPM"
          ),
          true // <- KNOWN-ISSUE
        );
      });

      it("[KNOWN-ISSUE] reject signed payload with length prefix longer than payload", () => {
        // Expected: false (length prefix declares more bytes than actual payload)
        assertEquals(
          StrKey.isValidSignedPayload(
            "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4Z2PQ"
          ),
          true // <- KNOWN-ISSUE
        );
      });

      it("[KNOWN-ISSUE] reject signed payload without zero padding", () => {
        // Expected: false (payloads < 64 bytes must be zero-padded to 64 bytes)
        assertEquals(
          StrKey.isValidSignedPayload(
            "PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DXFH6"
          ),
          true // <- KNOWN-ISSUE
        );
      });

      it("[KNOWN-ISSUE]  reject claimable balance with invalid type byte (not 0)", () => {
        // Expected: false (first byte should be 0x00 for CLAIMABLE_BALANCE_ID_TYPE_V0)
        assertEquals(
          StrKey.isValidClaimableBalanceId(
            "BAAT6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGXACA"
          ),
          true // <- KNOWN-ISSUE
        );
      });
    });

    describe("Decode error cases from Stellar SDK", () => {
      it("rejects when decoded data encodes to different string", () => {
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "GBPXX0A5N4JYPESHAADMQKBPWZWQDQ64ZV6ZL2S3LAGW4SY7NTCMWIVL"
            //    ^ note the '0' (zero) instead of 'O' (letter O)
            // This might decode, but re-encoding produces a different string
          ),
          false
        );
        assertEquals(
          StrKey.isValidEd25519PublicKey(
            "GCFZB6L25D26RQFDWSSBDEYQ32JHLRMTT44ZYE3DZQUTYOL7WY43PLBG++"
            //                                                              ^^ invalid chars
            // The ++ is clearly not valid base32
          ),
          false
        );
      });
    });
  });
});
