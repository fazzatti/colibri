/**
 * SEP-10 JWT Unit Tests
 */

import { assertEquals, assertThrows, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Sep10Jwt } from "@/client/jwt.ts";
import * as E from "@/client/error.ts";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a valid JWT token for testing
 */
function createTestJwt(
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = { alg: "EdDSA", typ: "JWT" }
): string {
  const encodeBase64url = (obj: unknown): string => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerPart = encodeBase64url(header);
  const payloadPart = encodeBase64url(claims);
  const signature = "fakesignature";

  return `${headerPart}.${payloadPart}.${signature}`;
}

// =============================================================================
// Tests
// =============================================================================

describe("Sep10Jwt", () => {
  describe("fromToken", () => {
    it("parses a valid JWT token", () => {
      const token = createTestJwt({
        sub: "GCLIENT123",
        iss: "https://auth.example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });

      const jwt = Sep10Jwt.fromToken(token);

      assertEquals(jwt.subject, "GCLIENT123");
      assertEquals(jwt.issuer, "https://auth.example.com");
      assertInstanceOf(jwt.expiresAt, Date);
      assertInstanceOf(jwt.issuedAt, Date);
    });

    it("throws INVALID_JWT for token with wrong number of parts", () => {
      const error = assertThrows(
        () => Sep10Jwt.fromToken("only.twoparts"),
        E.INVALID_JWT
      );
      assertEquals(error.code, E.Code.INVALID_JWT);
    });

    it("throws INVALID_JWT for token with invalid base64", () => {
      const error = assertThrows(
        () => Sep10Jwt.fromToken("invalid.!!!notbase64!!!.signature"),
        E.INVALID_JWT
      );
      assertEquals(error.code, E.Code.INVALID_JWT);
    });

    it("throws INVALID_JWT for token with invalid JSON payload", () => {
      const invalidPayload = btoa("not json")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
      const error = assertThrows(
        () => Sep10Jwt.fromToken(`header.${invalidPayload}.signature`),
        E.INVALID_JWT
      );
      assertEquals(error.code, E.Code.INVALID_JWT);
    });
  });

  describe("getters", () => {
    it("returns the raw token", () => {
      const token = createTestJwt({ sub: "GCLIENT" });
      const jwt = Sep10Jwt.fromToken(token);
      assertEquals(jwt.token, token);
    });

    it("returns subject (sub claim)", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({ sub: "GCLIENTABC" }));
      assertEquals(jwt.subject, "GCLIENTABC");
    });

    it("returns undefined for missing subject", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.subject, undefined);
    });

    it("returns issuer (iss claim)", () => {
      const jwt = Sep10Jwt.fromToken(
        createTestJwt({ iss: "https://auth.example.com" })
      );
      assertEquals(jwt.issuer, "https://auth.example.com");
    });

    it("returns undefined for missing issuer", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.issuer, undefined);
    });

    it("returns expiresAt as Date", () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const jwt = Sep10Jwt.fromToken(createTestJwt({ exp }));
      assertEquals(jwt.expiresAt?.getTime(), exp * 1000);
    });

    it("returns undefined for missing expiresAt", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.expiresAt, undefined);
    });

    it("returns issuedAt as Date", () => {
      const iat = Math.floor(Date.now() / 1000);
      const jwt = Sep10Jwt.fromToken(createTestJwt({ iat }));
      assertEquals(jwt.issuedAt?.getTime(), iat * 1000);
    });

    it("returns undefined for missing issuedAt", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.issuedAt, undefined);
    });

    it("returns jti claim", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({ jti: "unique-id-123" }));
      assertEquals(jwt.jti, "unique-id-123");
    });

    it("returns undefined for missing jti", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.jti, undefined);
    });
  });

  describe("isExpired", () => {
    it("returns false for non-expired token", () => {
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const jwt = Sep10Jwt.fromToken(createTestJwt({ exp }));
      assertEquals(jwt.isExpired, false);
    });

    it("returns true for expired token", () => {
      const exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const jwt = Sep10Jwt.fromToken(createTestJwt({ exp }));
      assertEquals(jwt.isExpired, true);
    });

    it("returns false when no expiration is set", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.isExpired, false);
    });
  });

  describe("timeUntilExpiration", () => {
    it("returns positive milliseconds for non-expired token", () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const jwt = Sep10Jwt.fromToken(createTestJwt({ exp }));
      const timeLeft = jwt.timeUntilExpiration;
      assertEquals(timeLeft !== undefined && timeLeft > 0, true);
    });

    it("returns negative milliseconds for expired token", () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      const jwt = Sep10Jwt.fromToken(createTestJwt({ exp }));
      const timeLeft = jwt.timeUntilExpiration;
      assertEquals(timeLeft !== undefined && timeLeft < 0, true);
    });

    it("returns undefined when no expiration", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.timeUntilExpiration, undefined);
    });
  });

  describe("SEP-10 specific claims", () => {
    it("returns homeDomain", () => {
      const jwt = Sep10Jwt.fromToken(
        createTestJwt({ home_domain: "example.com" })
      );
      assertEquals(jwt.homeDomain, "example.com");
    });

    it("returns clientDomain", () => {
      const jwt = Sep10Jwt.fromToken(
        createTestJwt({ client_domain: "wallet.example.com" })
      );
      assertEquals(jwt.clientDomain, "wallet.example.com");
    });

    it("returns webAuthDomain", () => {
      const jwt = Sep10Jwt.fromToken(
        createTestJwt({ web_auth_domain: "auth.example.com" })
      );
      assertEquals(jwt.webAuthDomain, "auth.example.com");
    });

    it("returns muxedAccountId", () => {
      const jwt = Sep10Jwt.fromToken(
        createTestJwt({ muxed_account_id: "12345" })
      );
      assertEquals(jwt.muxedAccountId, "12345");
    });

    it("returns memo", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({ memo: "67890" }));
      assertEquals(jwt.memo, "67890");
    });

    it("returns undefined for missing SEP-10 claims", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      assertEquals(jwt.homeDomain, undefined);
      assertEquals(jwt.clientDomain, undefined);
      assertEquals(jwt.webAuthDomain, undefined);
      assertEquals(jwt.muxedAccountId, undefined);
      assertEquals(jwt.memo, undefined);
    });
  });

  describe("claims", () => {
    it("returns all claims as readonly object", () => {
      const claims = {
        sub: "GCLIENT",
        iss: "https://auth.example.com",
        custom: "value",
      };
      const jwt = Sep10Jwt.fromToken(createTestJwt(claims));
      const result = jwt.claims;
      assertEquals(result.sub, "GCLIENT");
      assertEquals(result.iss, "https://auth.example.com");
      assertEquals(result.custom, "value");
    });

    it("returns a copy (immutable)", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({ sub: "GCLIENT" }));
      const claims1 = jwt.claims;
      const claims2 = jwt.claims;
      assertEquals(claims1 !== claims2, true); // Different object references
    });
  });

  describe("toString", () => {
    it("returns the raw token", () => {
      const token = createTestJwt({ sub: "GCLIENT" });
      const jwt = Sep10Jwt.fromToken(token);
      assertEquals(jwt.toString(), token);
    });
  });

  describe("toJSON", () => {
    it("returns a JSON representation", () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const iat = Math.floor(Date.now() / 1000);
      const token = createTestJwt({
        sub: "GCLIENT",
        iss: "https://auth.example.com",
        exp,
        iat,
        home_domain: "example.com",
        client_domain: "wallet.example.com",
      });
      const jwt = Sep10Jwt.fromToken(token);
      const json = jwt.toJSON();

      assertEquals(json.token, token);
      assertEquals(json.subject, "GCLIENT");
      assertEquals(json.issuer, "https://auth.example.com");
      assertEquals(json.homeDomain, "example.com");
      assertEquals(json.clientDomain, "wallet.example.com");
      assertEquals(json.isExpired, false);
      assertEquals(typeof json.expiresAt, "string"); // ISO string
      assertEquals(typeof json.issuedAt, "string");
    });

    it("handles missing optional fields", () => {
      const jwt = Sep10Jwt.fromToken(createTestJwt({}));
      const json = jwt.toJSON();

      assertEquals(json.subject, undefined);
      assertEquals(json.issuer, undefined);
      assertEquals(json.expiresAt, undefined);
      assertEquals(json.issuedAt, undefined);
      assertEquals(json.homeDomain, undefined);
      assertEquals(json.clientDomain, undefined);
    });
  });
});
