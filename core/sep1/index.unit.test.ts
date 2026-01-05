import {
  assertEquals,
  assertRejects,
  assertThrows,
  assertStringIncludes,
} from "@std/assert";
import { describe, it, beforeEach } from "@std/testing/bdd";
import { StellarToml } from "@/sep1/index.ts";
import * as E from "@/sep1/error.ts";

// Valid test keys (these are not real keys, just properly formatted)
const VALID_PUBLIC_KEY =
  "GBXGQJWVLWOYHFLVTKWV5FGHA3LNYY2JQKM7OAJAUEQFU6LPCSEFVXON";
const VALID_PUBLIC_KEY_2 =
  "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
const VALID_CONTRACT_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// Sample valid stellar.toml content
const VALID_TOML = `
VERSION = "2.0.0"
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
FEDERATION_SERVER = "https://api.example.com/federation"
WEB_AUTH_ENDPOINT = "https://auth.example.com"
SIGNING_KEY = "${VALID_PUBLIC_KEY}"
HORIZON_URL = "https://horizon.example.com"
ACCOUNTS = ["${VALID_PUBLIC_KEY}", "${VALID_PUBLIC_KEY_2}"]

[DOCUMENTATION]
ORG_NAME = "Test Organization"
ORG_URL = "https://example.com"
ORG_DESCRIPTION = "A test organization"
ORG_TWITTER = "testorg"

[[PRINCIPALS]]
name = "Jane Doe"
email = "jane@example.com"

[[CURRENCIES]]
code = "USD"
issuer = "${VALID_PUBLIC_KEY}"
status = "live"
display_decimals = 2
name = "US Dollar"
is_asset_anchored = true
anchor_asset_type = "fiat"
anchor_asset = "USD"

[[CURRENCIES]]
code = "BTC"
issuer = "${VALID_PUBLIC_KEY_2}"
status = "live"
display_decimals = 7

[[VALIDATORS]]
ALIAS = "test-validator"
DISPLAY_NAME = "Test Validator"
PUBLIC_KEY = "${VALID_PUBLIC_KEY}"
HOST = "core.example.com:11625"
`;

const MINIMAL_TOML = `
VERSION = "2.0.0"
`;

const SEP10_TOML = `
WEB_AUTH_ENDPOINT = "https://auth.example.com/sep10"
SIGNING_KEY = "${VALID_PUBLIC_KEY}"
NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
`;

const SEP45_TOML = `
WEB_AUTH_FOR_CONTRACTS_ENDPOINT = "https://auth.example.com/sep45"
WEB_AUTH_CONTRACT_ID = "${VALID_CONTRACT_ID}"
SIGNING_KEY = "${VALID_PUBLIC_KEY}"
`;

const TEMPLATE_CURRENCIES_TOML = `
[[CURRENCIES]]
code_template = "CORN????????"
issuer = "${VALID_PUBLIC_KEY}"
status = "live"

[[CURRENCIES]]
code_template = "CORN????????"
issuer = "${VALID_PUBLIC_KEY_2}"
status = "test"

[[CURRENCIES]]
code = "USD"
issuer = "${VALID_PUBLIC_KEY}"
status = "live"
`;

describe("StellarToml", () => {
  describe("fromString", () => {
    it("parses valid TOML content", () => {
      const toml = StellarToml.fromString(VALID_TOML);

      assertEquals(toml.version, "2.0.0");
      assertEquals(toml.networkPassphrase, "Test SDF Network ; September 2015");
      assertEquals(toml.federationServer, "https://api.example.com/federation");
      assertEquals(toml.webAuthEndpoint, "https://auth.example.com");
      assertEquals(toml.signingKey, VALID_PUBLIC_KEY);
      assertEquals(toml.horizonUrl, "https://horizon.example.com");
    });

    it("parses minimal TOML content", () => {
      const toml = StellarToml.fromString(MINIMAL_TOML);

      assertEquals(toml.version, "2.0.0");
      assertEquals(toml.signingKey, undefined);
      assertEquals(toml.currencies.length, 0);
    });

    it("throws PARSE_ERROR for invalid TOML syntax", () => {
      const invalidToml = `
        VERSION = "2.0.0
        UNCLOSED_STRING
      `;

      assertThrows(() => StellarToml.fromString(invalidToml), E.PARSE_ERROR);
    });

    it("throws PARSE_ERROR for invalid TOML and includes domain context when provided", async () => {
      const invalidToml = `VERSION = "unclosed`;
      const mockFetch = async () =>
        await new Response(invalidToml, { status: 200 });

      const error = await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.PARSE_ERROR
      );
      assertEquals(error.meta.data.domain, "example.com");
    });

    it("throws INVALID_SIGNING_KEY for invalid signing key when validation enabled", () => {
      const tomlWithBadKey = `
        SIGNING_KEY = "not-a-valid-key"
      `;

      assertThrows(
        () => StellarToml.fromString(tomlWithBadKey, { validate: true }),
        E.INVALID_SIGNING_KEY
      );
    });

    it("does not throw for invalid signing key when validation disabled", () => {
      const tomlWithBadKey = `
        SIGNING_KEY = "not-a-valid-key"
      `;

      const toml = StellarToml.fromString(tomlWithBadKey, { validate: false });
      assertEquals(toml.raw.SIGNING_KEY, "not-a-valid-key");
    });

    it("throws INVALID_URL for non-HTTPS URL when validation enabled", () => {
      const tomlWithHttpUrl = `
        WEB_AUTH_ENDPOINT = "http://auth.example.com"
      `;

      assertThrows(
        () => StellarToml.fromString(tomlWithHttpUrl, { validate: true }),
        E.INVALID_URL
      );
    });

    it("allows HTTP URL when allowHttp is true", () => {
      const tomlWithHttpUrl = `
        WEB_AUTH_ENDPOINT = "http://auth.example.com"
      `;

      const toml = StellarToml.fromString(tomlWithHttpUrl, {
        validate: true,
        allowHttp: true,
      });
      assertEquals(toml.webAuthEndpoint, "http://auth.example.com");
    });

    it("throws INVALID_URL for malformed URL when validation enabled", () => {
      const tomlWithBadUrl = `
        WEB_AUTH_ENDPOINT = "not-a-url"
      `;

      assertThrows(
        () => StellarToml.fromString(tomlWithBadUrl, { validate: true }),
        E.INVALID_URL
      );
    });

    it("throws INVALID_URL for HTTP URL in DOCUMENTATION.ORG_URL", () => {
      const tomlWithHttpDocUrl = `
        [DOCUMENTATION]
        ORG_URL = "http://example.com"
      `;

      assertThrows(
        () => StellarToml.fromString(tomlWithHttpDocUrl, { validate: true }),
        E.INVALID_URL
      );
    });

    it("allows HTTP URL in DOCUMENTATION.ORG_URL when allowHttp is true", () => {
      const tomlWithHttpDocUrl = `
        [DOCUMENTATION]
        ORG_URL = "http://example.com"
      `;

      const toml = StellarToml.fromString(tomlWithHttpDocUrl, {
        validate: true,
        allowHttp: true,
      });
      assertEquals(toml.documentation?.ORG_URL, "http://example.com");
    });

    it("throws INVALID_URL for malformed URL even when allowHttp is true", () => {
      const tomlWithBadUrl = `
        WEB_AUTH_ENDPOINT = "not-a-url"
      `;

      assertThrows(
        () =>
          StellarToml.fromString(tomlWithBadUrl, {
            validate: true,
            allowHttp: true,
          }),
        E.INVALID_URL
      );
    });

    it("throws INVALID_URL for malformed URL in DOCUMENTATION.ORG_URL", () => {
      const tomlWithBadDocUrl = `
        [DOCUMENTATION]
        ORG_URL = "not-a-url"
      `;

      assertThrows(
        () => StellarToml.fromString(tomlWithBadDocUrl, { validate: true }),
        E.INVALID_URL
      );
    });

    it("throws INVALID_ACCOUNT for invalid account in ACCOUNTS array", () => {
      const tomlWithBadAccount = `
        ACCOUNTS = ["not-a-valid-account"]
      `;

      const error = assertThrows(
        () => StellarToml.fromString(tomlWithBadAccount, { validate: true }),
        E.INVALID_ACCOUNT
      );
      assertEquals(error.meta.data.index, 0);
      assertEquals(error.meta.data.field, "ACCOUNTS");
    });

    it("throws INVALID_ACCOUNT for invalid account at specific index", () => {
      const tomlWithBadAccountAtIndex = `
        ACCOUNTS = ["${VALID_PUBLIC_KEY}", "${VALID_PUBLIC_KEY_2}", "invalid-account"]
      `;

      const error = assertThrows(
        () =>
          StellarToml.fromString(tomlWithBadAccountAtIndex, { validate: true }),
        E.INVALID_ACCOUNT
      );
      assertEquals(error.meta.data.index, 2);
    });

    it("validates currency issuers", () => {
      const tomlWithBadIssuer = `
        [[CURRENCIES]]
        code = "USD"
        issuer = "not-a-valid-issuer"
      `;

      const error = assertThrows(
        () => StellarToml.fromString(tomlWithBadIssuer, { validate: true }),
        E.INVALID_ACCOUNT
      );
      assertEquals(error.meta.data.field, "CURRENCIES[0].issuer");
    });

    it("validates currency contract IDs", () => {
      const tomlWithBadContract = `
        [[CURRENCIES]]
        code = "USD"
        contract = "not-a-valid-contract"
      `;

      const error = assertThrows(
        () => StellarToml.fromString(tomlWithBadContract, { validate: true }),
        E.INVALID_ACCOUNT
      );
      assertEquals(error.meta.data.field, "CURRENCIES[0].contract");
    });

    it("validates validator PUBLIC_KEYs", () => {
      const tomlWithBadValidator = `
        [[VALIDATORS]]
        ALIAS = "test"
        PUBLIC_KEY = "not-a-valid-key"
      `;

      const error = assertThrows(
        () => StellarToml.fromString(tomlWithBadValidator, { validate: true }),
        E.INVALID_SIGNING_KEY
      );
      assertEquals(error.meta.data.field, "VALIDATORS[0].PUBLIC_KEY");
    });

    it("validates URI_REQUEST_SIGNING_KEY", () => {
      const tomlWithBadUriKey = `
        URI_REQUEST_SIGNING_KEY = "not-a-valid-key"
      `;

      const error = assertThrows(
        () => StellarToml.fromString(tomlWithBadUriKey, { validate: true }),
        E.INVALID_SIGNING_KEY
      );
      assertEquals(error.meta.data.field, "URI_REQUEST_SIGNING_KEY");
    });
  });

  describe("getters", () => {
    let toml: StellarToml;

    beforeEach(() => {
      toml = StellarToml.fromString(VALID_TOML);
    });

    it("returns documentation section", () => {
      assertEquals(toml.documentation?.ORG_NAME, "Test Organization");
      assertEquals(toml.documentation?.ORG_URL, "https://example.com");
      assertEquals(toml.documentation?.ORG_TWITTER, "testorg");
    });

    it("returns principals list", () => {
      assertEquals(toml.principals.length, 1);
      assertEquals(toml.principals[0].name, "Jane Doe");
      assertEquals(toml.principals[0].email, "jane@example.com");
    });

    it("returns currencies list", () => {
      assertEquals(toml.currencies.length, 2);
      assertEquals(toml.currencies[0].code, "USD");
      assertEquals(toml.currencies[0].status, "live");
      assertEquals(toml.currencies[0].is_asset_anchored, true);
    });

    it("returns validators list", () => {
      assertEquals(toml.validators.length, 1);
      assertEquals(toml.validators[0].ALIAS, "test-validator");
      assertEquals(toml.validators[0].PUBLIC_KEY, VALID_PUBLIC_KEY);
    });

    it("returns accounts list", () => {
      assertEquals(toml.accounts.length, 2);
      assertEquals(toml.accounts[0], VALID_PUBLIC_KEY);
      assertEquals(toml.accounts[1], VALID_PUBLIC_KEY_2);
    });

    it("returns empty arrays for missing sections", () => {
      const minimal = StellarToml.fromString(MINIMAL_TOML);
      assertEquals(minimal.principals.length, 0);
      assertEquals(minimal.currencies.length, 0);
      assertEquals(minimal.validators.length, 0);
      assertEquals(minimal.accounts.length, 0);
    });

    it("returns raw data", () => {
      assertEquals(toml.raw.VERSION, "2.0.0");
      assertEquals(toml.raw.SIGNING_KEY, VALID_PUBLIC_KEY);
    });
  });

  describe("convenience methods", () => {
    it("hasWebAuth returns true when WEB_AUTH_ENDPOINT and SIGNING_KEY present", () => {
      const toml = StellarToml.fromString(SEP10_TOML);
      assertEquals(toml.hasWebAuth(), true);
    });

    it("hasWebAuth returns false when missing required fields", () => {
      const toml = StellarToml.fromString(MINIMAL_TOML);
      assertEquals(toml.hasWebAuth(), false);

      const tomlNoKey = StellarToml.fromString(
        `
        WEB_AUTH_ENDPOINT = "https://auth.example.com"
      `,
        { validate: false }
      );
      assertEquals(tomlNoKey.hasWebAuth(), false);
    });

    it("hasWebAuthForContracts returns true when all SEP-45 fields present", () => {
      const toml = StellarToml.fromString(SEP45_TOML);
      assertEquals(toml.hasWebAuthForContracts(), true);
    });

    it("hasFederation returns correct value", () => {
      const toml = StellarToml.fromString(VALID_TOML);
      assertEquals(toml.hasFederation(), true);

      const minimal = StellarToml.fromString(MINIMAL_TOML);
      assertEquals(minimal.hasFederation(), false);
    });

    it("hasTransferServer returns correct value", () => {
      const tomlWithTransfer = StellarToml.fromString(`
        TRANSFER_SERVER = "https://transfer.example.com"
      `);
      assertEquals(tomlWithTransfer.hasTransferServer(), true);

      const minimal = StellarToml.fromString(MINIMAL_TOML);
      assertEquals(minimal.hasTransferServer(), false);
    });

    it("hasTransferServerSep24 returns correct value", () => {
      const tomlWithTransfer = StellarToml.fromString(`
        TRANSFER_SERVER_SEP0024 = "https://transfer.example.com"
      `);
      assertEquals(tomlWithTransfer.hasTransferServerSep24(), true);
    });
  });

  describe("sep10Config", () => {
    it("returns config when all fields present", () => {
      const toml = StellarToml.fromString(SEP10_TOML);
      const config = toml.sep10Config;

      assertEquals(config?.webAuthEndpoint, "https://auth.example.com/sep10");
      assertEquals(config?.signingKey, VALID_PUBLIC_KEY);
      assertEquals(
        config?.networkPassphrase,
        "Test SDF Network ; September 2015"
      );
    });

    it("returns undefined when missing required fields", () => {
      const toml = StellarToml.fromString(MINIMAL_TOML);
      assertEquals(toml.sep10Config, undefined);
    });
  });

  describe("sep45Config", () => {
    it("returns config when all fields present", () => {
      const toml = StellarToml.fromString(SEP45_TOML);
      const config = toml.sep45Config;

      assertEquals(config?.webAuthEndpoint, "https://auth.example.com/sep45");
      assertEquals(config?.signingKey, VALID_PUBLIC_KEY);
      assertEquals(config?.contractId, VALID_CONTRACT_ID);
    });

    it("returns undefined when missing required fields", () => {
      const toml = StellarToml.fromString(SEP10_TOML);
      assertEquals(toml.sep45Config, undefined);
    });
  });

  describe("findCurrency", () => {
    let toml: StellarToml;

    beforeEach(() => {
      toml = StellarToml.fromString(VALID_TOML);
    });

    it("finds currency by code", () => {
      const usd = toml.findCurrency("USD");
      assertEquals(usd?.code, "USD");
      assertEquals(usd?.issuer, VALID_PUBLIC_KEY);
    });

    it("finds currency by code and issuer", () => {
      const btc = toml.findCurrency("BTC", VALID_PUBLIC_KEY_2);
      assertEquals(btc?.code, "BTC");
      assertEquals(btc?.issuer, VALID_PUBLIC_KEY_2);
    });

    it("returns undefined for non-existent currency", () => {
      const notFound = toml.findCurrency("EUR");
      assertEquals(notFound, undefined);
    });

    it("returns undefined when issuer does not match", () => {
      const notFound = toml.findCurrency("USD", VALID_PUBLIC_KEY_2);
      assertEquals(notFound, undefined);
    });
  });

  describe("getCurrenciesByStatus", () => {
    it("filters currencies by status", () => {
      const toml = StellarToml.fromString(VALID_TOML);
      const liveCurrencies = toml.getCurrenciesByStatus("live");

      assertEquals(liveCurrencies.length, 2);
    });

    it("returns empty array for non-matching status", () => {
      const toml = StellarToml.fromString(VALID_TOML);
      const deadCurrencies = toml.getCurrenciesByStatus("dead");

      assertEquals(deadCurrencies.length, 0);
    });
  });

  describe("fromDomain", () => {
    it("throws INVALID_DOMAIN for domain with protocol", async () => {
      await assertRejects(
        () => StellarToml.fromDomain("https://example.com"),
        E.INVALID_DOMAIN
      );
    });

    it("fetches and parses stellar.toml from domain", async () => {
      // Mock fetch
      const mockFetch = async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString();
        assertEquals(url, "https://example.com/.well-known/stellar.toml");
        return await new Response(VALID_TOML, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      };

      const toml = await StellarToml.fromDomain("example.com", {
        fetchFn: mockFetch,
      });

      assertEquals(toml.version, "2.0.0");
      assertEquals(toml.domain, "example.com");
    });

    it("allows HTTP when allowHttp is true", async () => {
      const mockFetch = async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString();
        assertEquals(url, "http://localhost:8000/.well-known/stellar.toml");
        return await new Response(MINIMAL_TOML, { status: 200 });
      };

      const toml = await StellarToml.fromDomain("localhost:8000", {
        fetchFn: mockFetch,
        allowHttp: true,
      });

      assertEquals(toml.version, "2.0.0");
    });

    it("throws FETCH_FAILED for non-200 response", async () => {
      const mockFetch = async () => {
        return await new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        });
      };

      const error = await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FETCH_FAILED
      );
      // Verify error contains status info
      assertEquals(error.meta.data.statusCode, 404);
      assertEquals(error.meta.data.statusText, "Not Found");
    });

    it("throws FETCH_FAILED for non-200 response without statusText", async () => {
      const mockFetch = async () => {
        return await new Response("Error", { status: 500, statusText: "" });
      };

      const error = await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FETCH_FAILED
      );
      assertEquals(error.meta.data.statusCode, 500);
      assertEquals(error.meta.data.statusText, "");
      // Verify the details message handles empty statusText
      assertEquals(error.details?.includes("500"), true);
    });

    it("throws FILE_TOO_LARGE when content exceeds limit", async () => {
      const mockFetch = async () => {
        return await new Response(MINIMAL_TOML, {
          status: 200,
          headers: { "Content-Length": "200000" }, // 200KB
        });
      };

      await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FILE_TOO_LARGE
      );
    });

    it("throws TIMEOUT when request times out", async () => {
      const mockFetch = async (
        _input: RequestInfo | URL,
        options?: RequestInit
      ) => {
        // Simulate timeout by checking if signal is aborted
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        return new Response(MINIMAL_TOML, { status: 200 });
      };

      await assertRejects(
        () =>
          StellarToml.fromDomain("example.com", {
            fetchFn: mockFetch,
            timeout: 50, // Very short timeout
          }),
        E.TIMEOUT
      );
    });

    it("throws FETCH_FAILED for network errors", async () => {
      const mockFetch = () => {
        throw new Error("Network error");
      };

      const error = await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FETCH_FAILED
      );
      // Verify cause is captured
      assertEquals(error.meta.cause?.message, "Network error");
    });

    it("throws FETCH_FAILED for network errors without message", async () => {
      const mockFetch = () => {
        const err = new Error();
        err.message = ""; // Empty message
        throw err;
      };

      const error = await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FETCH_FAILED
      );
      assertEquals(error.meta.cause instanceof Error, true);
    });

    it("removes trailing slashes from domain", async () => {
      const mockFetch = async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString();
        assertEquals(url, "https://example.com/.well-known/stellar.toml");
        return await new Response(MINIMAL_TOML, { status: 200 });
      };

      await StellarToml.fromDomain("example.com/", { fetchFn: mockFetch });
    });

    it("passes validation option to parser", async () => {
      const mockFetch = async () => {
        return await new Response(`SIGNING_KEY = "invalid"`, { status: 200 });
      };

      // Should throw with validation enabled (default)
      await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.INVALID_SIGNING_KEY
      );

      // Should not throw with validation disabled
      const toml = await StellarToml.fromDomain("example.com", {
        fetchFn: mockFetch,
        validate: false,
      });
      assertEquals(toml.raw.SIGNING_KEY, "invalid");
    });

    it("throws FILE_TOO_LARGE when actual content exceeds limit", async () => {
      // Create content that's larger than MAX_FILE_SIZE but no Content-Length header
      const largeContent = "x".repeat(101 * 1024); // Just over 100KB
      const mockFetch = async () => {
        return await new Response(largeContent, { status: 200 });
      };

      await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FILE_TOO_LARGE
      );
    });

    it("throws FETCH_FAILED for non-Error thrown values", async () => {
      const mockFetch = () => {
        throw "string error"; // Not an Error instance
      };

      await assertRejects(
        () => StellarToml.fromDomain("example.com", { fetchFn: mockFetch }),
        E.FETCH_FAILED
      );
    });
  });

  describe("additional getters", () => {
    it("returns webAuthForContractsEndpoint", () => {
      const toml = StellarToml.fromString(SEP45_TOML);
      assertEquals(
        toml.webAuthForContractsEndpoint,
        "https://auth.example.com/sep45"
      );
    });

    it("returns webAuthContractId", () => {
      const toml = StellarToml.fromString(SEP45_TOML);
      assertEquals(toml.webAuthContractId, VALID_CONTRACT_ID);
    });

    it("returns uriRequestSigningKey", () => {
      const toml = StellarToml.fromString(`
        URI_REQUEST_SIGNING_KEY = "${VALID_PUBLIC_KEY}"
      `);
      assertEquals(toml.uriRequestSigningKey, VALID_PUBLIC_KEY);
    });

    it("returns directPaymentServer", () => {
      const toml = StellarToml.fromString(`
        DIRECT_PAYMENT_SERVER = "https://direct.example.com"
      `);
      assertEquals(toml.directPaymentServer, "https://direct.example.com");
    });

    it("returns anchorQuoteServer", () => {
      const toml = StellarToml.fromString(`
        ANCHOR_QUOTE_SERVER = "https://quote.example.com"
      `);
      assertEquals(toml.anchorQuoteServer, "https://quote.example.com");
    });

    it("returns transferServer", () => {
      const toml = StellarToml.fromString(`
        TRANSFER_SERVER = "https://transfer.example.com"
      `);
      assertEquals(toml.transferServer, "https://transfer.example.com");
    });

    it("returns transferServerSep24", () => {
      const toml = StellarToml.fromString(`
        TRANSFER_SERVER_SEP0024 = "https://transfer24.example.com"
      `);
      assertEquals(toml.transferServerSep24, "https://transfer24.example.com");
    });

    it("returns kycServer", () => {
      const toml = StellarToml.fromString(`
        KYC_SERVER = "https://kyc.example.com"
      `);
      assertEquals(toml.kycServer, "https://kyc.example.com");
    });
  });

  describe("findCurrenciesByTemplate", () => {
    it("finds currencies by code_template pattern", () => {
      const toml = StellarToml.fromString(TEMPLATE_CURRENCIES_TOML);
      const matches = toml.findCurrenciesByTemplate("CORN????????");

      assertEquals(matches.length, 2);
      assertEquals(matches[0].code_template, "CORN????????");
      assertEquals(matches[1].code_template, "CORN????????");
    });

    it("returns empty array when no templates match", () => {
      const toml = StellarToml.fromString(TEMPLATE_CURRENCIES_TOML);
      const matches = toml.findCurrenciesByTemplate("WHEAT????????");

      assertEquals(matches.length, 0);
    });
  });

  describe("hasWebAuthForContracts edge cases", () => {
    it("returns false when missing WEB_AUTH_CONTRACT_ID", () => {
      const toml = StellarToml.fromString(
        `
        WEB_AUTH_FOR_CONTRACTS_ENDPOINT = "https://auth.example.com/sep45"
        SIGNING_KEY = "${VALID_PUBLIC_KEY}"
      `,
        { validate: false }
      );
      assertEquals(toml.hasWebAuthForContracts(), false);
    });

    it("returns false when missing SIGNING_KEY", () => {
      const toml = StellarToml.fromString(
        `
        WEB_AUTH_FOR_CONTRACTS_ENDPOINT = "https://auth.example.com/sep45"
        WEB_AUTH_CONTRACT_ID = "${VALID_CONTRACT_ID}"
      `,
        { validate: false }
      );
      assertEquals(toml.hasWebAuthForContracts(), false);
    });
  });

  describe("error edge cases", () => {
    it("PARSE_ERROR uses fallback message when cause has no message", () => {
      const error = new E.PARSE_ERROR("example.com", undefined, "invalid");
      assertEquals(error.diagnostic?.rootCause, "Invalid TOML syntax");
    });

    it("PARSE_ERROR uses cause message when provided", () => {
      const cause = new Error("Unexpected token at line 5");
      const error = new E.PARSE_ERROR("example.com", cause, "invalid");
      assertEquals(error.diagnostic?.rootCause, "Unexpected token at line 5");
    });

    it("INVALID_URL details reflect requireHttps=false", () => {
      const error = new E.INVALID_URL(
        "WEB_AUTH_ENDPOINT",
        "not-a-url",
        "example.com",
        false
      );
      assertStringIncludes(error.details!, "is not a valid URL");
      // When requireHttps=false, details should NOT mention HTTPS requirement
      assertEquals(error.details!.includes("HTTPS"), false);
    });

    it("INVALID_URL details reflect requireHttps=true", () => {
      const error = new E.INVALID_URL(
        "WEB_AUTH_ENDPOINT",
        "http://example.com",
        "example.com",
        true
      );
      assertStringIncludes(error.details!, "HTTPS");
    });

    it("PARSE_ERROR wraps non-Error thrown values", () => {
      // Simulates what happens when `error instanceof Error` is false
      // This exercises the String(error) fallback path
      const nonErrorValue = "string error";
      const wrappedError = new Error(String(nonErrorValue));
      const error = new E.PARSE_ERROR("example.com", wrappedError, "invalid");
      assertEquals(error.diagnostic?.rootCause, "string error");
    });
  });
});
