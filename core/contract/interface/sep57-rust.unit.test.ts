import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Spec } from "stellar-sdk/contract";
import {
  ContractStandards,
  extractContractSpec,
  matchesContractInterface,
} from "@/mod.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";

describe("SEP-57 Rust ABI compatibility", () => {
  it("matches the independent Rust-generated Identity Claims specification", async () => {
    const wasm = await loadWasmFile(
      "_internal/tests/compiled-contracts/sep57_identity_claims_contract.wasm",
    );
    const spec = extractContractSpec(wasm);
    assertEquals(spec instanceof Spec, true);
    const claim = spec.entries.find((entry) =>
      entry.type === "scSpecEntryUdtStructV0"
    );
    assertEquals(
      claim?.udtStructV0.fields.map((field) => field.name.toString()),
      [
        "data",
        "issuer",
        "scheme",
        "signature",
        "topic",
        "uri",
      ],
    );
    assertEquals(
      matchesContractInterface(
        spec,
        ContractStandards.SEP57.interfaces.identityClaims.latest,
      ),
      true,
    );
  });
});
