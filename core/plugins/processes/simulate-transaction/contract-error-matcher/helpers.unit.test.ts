import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  ErrorByCode,
  ERRORS_CONTRACT_SPEC,
} from "colibri-internal/tests/specs/errors-contract.ts";
import {
  extractContractErrorMapFromWasm,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/index.ts";
import { extractContractErrorMapFromSpec } from "@/plugins/processes/simulate-transaction/contract-error-matcher/helpers.ts";
import * as E from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
import { Spec } from "stellar-sdk/contract";
import {
  bindingSpec,
  errorEntry,
} from "colibri-internal/tests/binding-fixtures.ts";

describe("contract error matcher helpers", () => {
  it("extracts the error map from a contract spec", () => {
    const errors = extractContractErrorMapFromSpec(ERRORS_CONTRACT_SPEC);

    assertEquals(errors, ErrorByCode);
    assertEquals(
      errors[265].details,
      "The requested operation cannot continue because the test contract emitted error code 265.",
    );
    assertEquals(errors[65535].details, undefined);
  });

  it("extracts the error map from contract wasm bytes", async () => {
    const wasm = await loadWasmFile(
      "./_internal/tests/compiled-contracts/errors_contract.wasm",
    );

    const errors = extractContractErrorMapFromWasm(wasm);

    assertEquals(errors, ErrorByCode);
    assertEquals(
      errors[3477].details,
      "Cross-contract diagnostic path used when verifying larger contract error codes.",
    );
    assertEquals(errors[700001].details, undefined);
  });

  it("throws when a spec declares duplicate error codes", () => {
    const spec = new Spec([
      errorEntry("AccessError"),
      errorEntry("TokenError"),
    ]);

    assertThrows(
      () => extractContractErrorMapFromSpec(spec),
      E.DUPLICATE_CONTRACT_ERROR_CODE,
    );
  });

  it("preserves each declaring enum and case name without inventing categories", () => {
    const spec = new Spec([
      ...bindingSpec().entries,
      errorEntry("access_error", 10, "NotAllowed", "  Requires a role.  "),
      errorEntry("TokenError", 20, "NotAllowed", ""),
    ]);
    assertEquals(extractContractErrorMapFromSpec(spec), {
      10: {
        name: "NotAllowed",
        category: "access_error",
        message: "NotAllowed",
        details: "Requires a role.",
      },
      20: { name: "NotAllowed", category: "TokenError", message: "NotAllowed" },
    });
    assertEquals(extractContractErrorMapFromSpec(bindingSpec()), {});
  });
});
