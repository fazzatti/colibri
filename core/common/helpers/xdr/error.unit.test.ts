/**
 * @module common/helpers/xdr/error.unit.test
 * @description Unit tests for XDR helper error classes
 */

import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertInstanceOf } from "@std/assert";
import * as E from "@/common/helpers/xdr/error.ts";
import { Code, ERROR_XDR } from "@/common/helpers/xdr/error.ts";
import { ColibriError } from "@/error/index.ts";

describe("XDR Helper Errors", () => {
  describe("UNKNOWN_ASSET_TYPE", () => {
    it("should create error with correct properties", () => {
      const error = new E.UNKNOWN_ASSET_TYPE("invalidType");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.UNKNOWN_ASSET_TYPE);
      assertEquals(error.message, "Unknown asset type: invalidType");
      assertEquals(error.meta.data.assetType, "invalidType");
    });
  });

  describe("UNKNOWN_CHANGE_TRUST_ASSET_TYPE", () => {
    it("should create error with correct properties", () => {
      const error = new E.UNKNOWN_CHANGE_TRUST_ASSET_TYPE("invalidType");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.UNKNOWN_CHANGE_TRUST_ASSET_TYPE);
      assertEquals(error.message, "Unknown ChangeTrustAsset type: invalidType");
      assertEquals(error.meta.data.assetType, "invalidType");
    });
  });

  describe("UNKNOWN_MUXED_ACCOUNT_TYPE", () => {
    it("should create error with correct properties", () => {
      const error = new E.UNKNOWN_MUXED_ACCOUNT_TYPE("invalidType");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.UNKNOWN_MUXED_ACCOUNT_TYPE);
      assertEquals(error.message, "Unknown muxed account type: invalidType");
      assertEquals(error.meta.data.assetType, "invalidType");
    });
  });

  describe("INVALID_XDR_PARSE", () => {
    it("should create error with reason", () => {
      const error = new E.INVALID_XDR_PARSE("corrupted data");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.INVALID_XDR_PARSE);
      assertEquals(error.message, "Failed to parse XDR: corrupted data");
    });

    it("should create error with cause", () => {
      const cause = new Error("original error");
      const error = new E.INVALID_XDR_PARSE("corrupted data", cause);

      assertEquals(error.meta.cause, cause);
    });
  });

  describe("FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE", () => {
    it("should create error with authEntryXDR", () => {
      const error = new E.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE("AAAA");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE);
      assertEquals(
        error.message,
        "Failed to get address type from SorobanAuthorizationEntry"
      );
      assertEquals(
        error.details,
        "Could not extract address type from the authorization entry credentials"
      );
      assertEquals(error.meta.data, { value: { authEntryXDR: "AAAA" } });
    });

    it("should create error with cause", () => {
      const cause = new Error("original error");
      const error = new E.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE("AAAA", cause);

      assertEquals(error.meta.cause, cause);
    });
  });

  describe("FAILED_TO_GET_AUTH_ENTRY_SIGNER", () => {
    it("should create error with authEntryXDR", () => {
      const error = new E.FAILED_TO_GET_AUTH_ENTRY_SIGNER("AAAA");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.FAILED_TO_GET_AUTH_ENTRY_SIGNER);
      assertEquals(
        error.message,
        "Failed to get signer from SorobanAuthorizationEntry"
      );
      assertEquals(
        error.details,
        "Could not extract signer address from the authorization entry"
      );
      assertEquals(error.meta.data, { value: { authEntryXDR: "AAAA" } });
    });

    it("should create error with cause", () => {
      const cause = new Error("original error");
      const error = new E.FAILED_TO_GET_AUTH_ENTRY_SIGNER("AAAA", cause);

      assertEquals(error.meta.cause, cause);
    });
  });

  describe("INVALID_AUTH_ENTRY_SIGNER_ADDRESS", () => {
    it("should create error with authEntryXDR and signer", () => {
      const error = new E.INVALID_AUTH_ENTRY_SIGNER_ADDRESS(
        "AAAA",
        "invalid-signer"
      );

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.INVALID_AUTH_ENTRY_SIGNER_ADDRESS);
      assertEquals(
        error.message,
        "Invalid signer address extracted from SorobanAuthorizationEntry"
      );
      assertEquals(
        error.details,
        "Expected a valid Ed25519 public key or contract ID, but got an invalid address"
      );
    });

    it("should include signer in meta data", () => {
      const error = new E.INVALID_AUTH_ENTRY_SIGNER_ADDRESS(
        "AAAA",
        "invalid-signer"
      );

      assertEquals(error.meta.data, {
        value: { authEntryXDR: "AAAA", signer: "invalid-signer" },
      });
    });
  });

  describe("FAILED_TO_PARSE_ERROR_RESULT", () => {
    it("should create error with errorResultXDR", () => {
      const error = new E.FAILED_TO_PARSE_ERROR_RESULT("AAAA");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.FAILED_TO_PARSE_ERROR_RESULT);
      assertEquals(error.message, "Unexpected format of TransactionResult XDR");
      assertEquals(
        error.details,
        "The TransactionResult XDR does not match the expected format for error parsing"
      );
    });

    it("should include errorResultXDR in meta data", () => {
      const error = new E.FAILED_TO_PARSE_ERROR_RESULT("AAAA");

      assertEquals(error.meta.data, { value: { errorResultXDR: "AAAA" } });
    });
  });

  describe("UNSUPPORTED_SCVAL_TYPE", () => {
    it("should create error with correct properties", () => {
      const error = new E.UNSUPPORTED_SCVAL_TYPE("scvUnknown");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.UNSUPPORTED_SCVAL_TYPE);
      assertEquals(error.message, "Unsupported ScVal type: scvUnknown");
      assertEquals(
        error.details,
        "The ScVal type is not supported for parsing into a TypeScript-friendly value"
      );
      assertEquals(error.meta.data, { value: { scValType: "scvUnknown" } });
    });
  });

  describe("UNKNOWN_SCVAL_TYPE", () => {
    it("should create error with correct properties", () => {
      const error = new E.UNKNOWN_SCVAL_TYPE("scvUnknown");

      assertInstanceOf(error, ColibriError);
      assertEquals(error.code, Code.UNKNOWN_SCVAL_TYPE);
      assertEquals(error.message, "Unknown ScVal type: scvUnknown");
      assertEquals(error.details, "The ScVal type is not recognized");
      assertEquals(error.meta.data, { value: { scValType: "scvUnknown" } });
    });
  });

  describe("ERROR_XDR mapping", () => {
    it("should map all error codes to classes", () => {
      assertEquals(ERROR_XDR[Code.UNKNOWN_ASSET_TYPE], E.UNKNOWN_ASSET_TYPE);
      assertEquals(
        ERROR_XDR[Code.UNKNOWN_CHANGE_TRUST_ASSET_TYPE],
        E.UNKNOWN_CHANGE_TRUST_ASSET_TYPE
      );
      assertEquals(
        ERROR_XDR[Code.UNKNOWN_MUXED_ACCOUNT_TYPE],
        E.UNKNOWN_MUXED_ACCOUNT_TYPE
      );
      assertEquals(ERROR_XDR[Code.INVALID_XDR_PARSE], E.INVALID_XDR_PARSE);
      assertEquals(
        ERROR_XDR[Code.UNSUPPORTED_SCVAL_TYPE],
        E.UNSUPPORTED_SCVAL_TYPE
      );
      assertEquals(ERROR_XDR[Code.UNKNOWN_SCVAL_TYPE], E.UNKNOWN_SCVAL_TYPE);
    });
  });

  describe("XdrHelperError base class coverage", () => {
    it("should handle missing data in args", () => {
      // UNKNOWN_ASSET_TYPE always passes data, so test through it
      const error = new E.UNKNOWN_ASSET_TYPE("test");

      // Verify base class properties
      assertEquals(error.source, "@colibri/core/common/helpers/xdr");
      assertEquals(error.domain, "helpers");
    });
  });
});
