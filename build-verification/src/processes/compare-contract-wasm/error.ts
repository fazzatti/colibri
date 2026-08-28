import { BuildVerificationError, Code } from "../../error/base.ts";

/** Raised when raw byte comparison fails outside its deterministic contract. */
export class CompareContractWasmUnexpectedError
  extends BuildVerificationError<Code.COMPARE_WASM_UNEXPECTED> {
  /** Creates an unexpected comparison-process error. */
  constructor(cause: unknown) {
    super({
      code: Code.COMPARE_WASM_UNEXPECTED,
      source: "@colibri/build-verification/processes/compare-contract-wasm",
      message: "Unexpected contract Wasm comparison failure",
      details:
        "The comparison process failed outside a known typed occurrence.",
      cause,
    });
  }
}
