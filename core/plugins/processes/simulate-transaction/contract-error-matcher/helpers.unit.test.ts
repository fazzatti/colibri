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
import type { Spec } from "stellar-sdk/contract";

describe("contract error matcher helpers", () => {
  it("extracts the error map from a contract spec", () => {
    const errors = extractContractErrorMapFromSpec(ERRORS_CONTRACT_SPEC);

    assertEquals(errors, ErrorByCode);
  });

  it("extracts the error map from contract wasm bytes", async () => {
    const wasm = await loadWasmFile(
      "./_internal/tests/compiled-contracts/errors_contract.wasm",
    );

    const errors = extractContractErrorMapFromWasm(wasm);

    assertEquals(errors, ErrorByCode);
  });

  it("throws when a spec declares duplicate error codes", () => {
    const spec = {
      errorCases: () => [
        {
          value: () => 1,
          name: () => ({ toString: () => "One" }),
        },
        {
          value: () => 1,
          name: () => ({ toString: () => "DuplicateOne" }),
        },
      ],
    } as unknown as Spec;

    assertThrows(
      () => extractContractErrorMapFromSpec(spec),
      E.DUPLICATE_CONTRACT_ERROR_CODE,
    );
  });
});
