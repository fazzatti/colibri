/**
 * Integration test for StellarToml fetching from a live domain.
 *
 * This test fetches the stellar.toml from ultracapital.xyz and validates
 * that the structure is parsed correctly. We don't hardcode values since
 * they may change over time, but we validate the expected fields exist
 * and have valid types/formats.
 *
 * Run with: deno test core/sep1/index.integration.test.ts --allow-net
 */
import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { StellarToml } from "@/sep1/index.ts";
import { StrKey } from "@/strkeys/index.ts";

describe("StellarToml Integration", () => {
  describe("ultracapital.xyz", () => {
    it("fetches and parses stellar.toml from ultracapital.xyz", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      // Verify domain is set
      assertEquals(toml.domain, "ultracapital.xyz");

      // Verify we got data
      assertExists(toml.raw);
    });

    it("has valid VERSION field", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.version);
      assert(typeof toml.version === "string", "VERSION should be a string");
      // Version format check (e.g., "2.2.0")
      assert(
        /^\d+\.\d+\.\d+$/.test(toml.version),
        `VERSION should be semver format, got: ${toml.version}`
      );
    });

    it("has valid NETWORK_PASSPHRASE", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.networkPassphrase);
      assertEquals(
        toml.networkPassphrase,
        "Public Global Stellar Network ; September 2015",
        "Should be on Stellar mainnet"
      );
    });

    it("has valid SIGNING_KEY", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.signingKey);
      assert(
        StrKey.isValidEd25519PublicKey(toml.signingKey),
        `SIGNING_KEY should be a valid Stellar public key, got: ${toml.signingKey}`
      );
    });

    it("has valid WEB_AUTH_ENDPOINT (SEP-10 support)", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.webAuthEndpoint);
      assert(
        toml.webAuthEndpoint.startsWith("https://"),
        "WEB_AUTH_ENDPOINT should be HTTPS"
      );
      assert(toml.hasWebAuth(), "Should support SEP-10 web auth");

      // Verify sep10Config is properly formed
      const sep10 = toml.sep10Config;
      assertExists(sep10);
      assertExists(sep10.webAuthEndpoint);
      assertExists(sep10.signingKey);
    });

    it("has valid TRANSFER_SERVER (SEP-6 support)", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.transferServer);
      assert(
        toml.transferServer.startsWith("https://"),
        "TRANSFER_SERVER should be HTTPS"
      );
      assert(toml.hasTransferServer(), "Should support SEP-6");
    });

    it("has valid TRANSFER_SERVER_SEP0024 (SEP-24 support)", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.transferServerSep24);
      assert(
        toml.transferServerSep24.startsWith("https://"),
        "TRANSFER_SERVER_SEP0024 should be HTTPS"
      );
      assert(toml.hasTransferServerSep24(), "Should support SEP-24");
    });

    it("has valid ACCOUNTS array", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assert(toml.accounts.length > 0, "Should have at least one account");

      // Verify all accounts are valid Stellar public keys
      for (const account of toml.accounts) {
        assert(
          StrKey.isValidEd25519PublicKey(account),
          `Account should be valid public key, got: ${account}`
        );
      }
    });

    it("has valid DOCUMENTATION section", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assertExists(toml.documentation);

      // Check required org fields exist
      assertExists(toml.documentation.ORG_NAME);
      assert(
        typeof toml.documentation.ORG_NAME === "string",
        "ORG_NAME should be a string"
      );

      assertExists(toml.documentation.ORG_URL);
      assert(
        toml.documentation.ORG_URL.startsWith("https://"),
        "ORG_URL should be HTTPS"
      );

      // Check optional but expected fields
      if (toml.documentation.ORG_LOGO) {
        assert(
          toml.documentation.ORG_LOGO.startsWith("https://"),
          "ORG_LOGO should be HTTPS URL"
        );
      }

      if (toml.documentation.ORG_OFFICIAL_EMAIL) {
        assert(
          toml.documentation.ORG_OFFICIAL_EMAIL.includes("@"),
          "ORG_OFFICIAL_EMAIL should be an email"
        );
      }
    });

    it("has valid CURRENCIES array", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      assert(toml.currencies.length > 0, "Should have at least one currency");

      for (const currency of toml.currencies) {
        // code is required
        assertExists(currency.code, "Currency should have a code");
        assert(
          typeof currency.code === "string" && currency.code.length <= 12,
          `Currency code should be string <= 12 chars, got: ${currency.code}`
        );

        // issuer should be valid if present
        if (currency.issuer) {
          assert(
            StrKey.isValidEd25519PublicKey(currency.issuer),
            `Currency issuer should be valid public key, got: ${currency.issuer}`
          );
        }

        // status should be valid if present
        if (currency.status) {
          assert(
            ["live", "dead", "test", "private"].includes(currency.status),
            `Currency status should be valid, got: ${currency.status}`
          );
        }

        // image should be URL if present
        if (currency.image) {
          assert(
            currency.image.startsWith("http"),
            `Currency image should be URL, got: ${currency.image}`
          );
        }
      }
    });

    it("can find specific currencies by code", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      // These are known currencies from ultracapital - they should exist
      const knownCurrencies = ["yUSDC", "yXLM", "yETH", "yBTC", "ETH", "BTC"];

      for (const code of knownCurrencies) {
        const currency = toml.findCurrency(code);
        // Currency might not exist if they remove it, so we just check
        // that findCurrency works and returns the right type
        if (currency) {
          assertEquals(currency.code, code);
          assertExists(currency.issuer);
        }
      }
    });

    it("can filter currencies by status", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      const liveCurrencies = toml.getCurrenciesByStatus("live");

      // All returned currencies should have status "live"
      for (const currency of liveCurrencies) {
        assertEquals(currency.status, "live");
      }
    });

    it("currencies have proper anchored asset info", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz");

      // Check that anchored assets have proper metadata
      const anchoredCurrencies = toml.currencies.filter(
        (c) => c.is_asset_anchored
      );

      for (const currency of anchoredCurrencies) {
        // If asset is anchored, should have anchor_asset info
        assertExists(
          currency.anchor_asset,
          `Anchored currency ${currency.code} should have anchor_asset`
        );
        assertExists(
          currency.anchor_asset_type,
          `Anchored currency ${currency.code} should have anchor_asset_type`
        );

        // anchor_asset_type should be valid
        const validTypes = [
          "fiat",
          "crypto",
          "nft",
          "stock",
          "bond",
          "commodity",
          "realestate",
          "other",
        ];
        assert(
          validTypes.includes(currency.anchor_asset_type!),
          `anchor_asset_type should be valid, got: ${currency.anchor_asset_type}`
        );
      }
    });

    it("validates without errors (strict mode)", async () => {
      // This test ensures the TOML passes all validation rules
      // If ultracapital.xyz has invalid data, this will throw
      const toml = await StellarToml.fromDomain("ultracapital.xyz", {
        validate: true,
      });

      // If we get here, validation passed
      assertExists(toml);
    });

    it("can also parse with validation disabled", async () => {
      const toml = await StellarToml.fromDomain("ultracapital.xyz", {
        validate: false,
      });

      // Should still parse successfully
      assertExists(toml);
      assertExists(toml.raw);
    });
  });
});
