import { Spec } from "@/contract/spec.ts";
import type { BinaryData } from "@/common/types/index.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";
import * as E from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
import type { ContractErrorMap } from "@/plugins/processes/simulate-transaction/contract-error-matcher/types.ts";

/**
 * Extracts known contract-error codes from a contract specification.
 *
 * The returned map is directly usable with
 * `createContractErrorMatcherPlugin(...)`. Each error enum case is mapped by
 * numeric code, its enum case name becomes the human-facing message, and a
 * non-empty case doc string becomes the optional details field. The original
 * case name and declaring error enum name are retained as name and category.
 *
 * @param spec - Contract specification containing error enum cases.
 * @returns Error-code map suitable for the contract-error matcher plugin.
 * @throws When the spec declares the same contract error code more than once.
 *
 * @example Extract a matcher map from an existing spec.
 * ```ts
 * const errors = extractContractErrorMapFromSpec(spec);
 * ```
 */
export function extractContractErrorMapFromSpec(
  spec: Spec,
): ContractErrorMap {
  const errors: Record<number, ContractErrorMap[number]> = {};

  for (const entry of spec.entries) {
    if (entry.type !== "scSpecEntryUdtErrorEnumV0") continue;
    const category = entry.value.name.toString();
    for (const errorCase of entry.value.cases) {
      const code = errorCase.value;

      if (errors[code]) {
        throw new E.DUPLICATE_CONTRACT_ERROR_CODE(code);
      }

      const details = errorCase.doc.toString().trim();

      errors[code] = {
        name: errorCase.name.toString(),
        category,
        message: errorCase.name.toString(),
        ...(details ? { details } : {}),
      };
    }
  }

  return errors;
}

/**
 * Extracts known contract-error codes from a contract WASM binary.
 *
 * Use this helper when you have local WASM bytes and want a simple
 * `{ code: { message } }` map. It does not choose a matching strategy; pass the
 * returned map directly to `createContractErrorMatcherPlugin(...)`, wrap it in a
 * strategy entry yourself, or use `Contract.loadContractErrorsFromWasm(...)` for
 * the high-level client convenience path.
 *
 * @param wasm - Contract WASM bytes containing a `contractspecv0` section.
 * @returns Error-code map suitable for the contract-error matcher plugin.
 *
 * @example Extract a matcher map from local WASM.
 * ```ts
 * const wasm = await Deno.readFile("./contract.wasm");
 * const errors = extractContractErrorMapFromWasm(wasm);
 * ```
 */
export function extractContractErrorMapFromWasm(
  wasm: BinaryData,
): ContractErrorMap {
  return extractContractErrorMapFromSpec(Spec.fromWasm(toUint8Array(wasm)));
}
