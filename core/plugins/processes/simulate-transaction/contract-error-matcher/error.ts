import { PluginError } from "@/plugins/error.ts";
import type { CONTRACT_ERROR_SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import type { KnownContractErrorMatch } from "@/plugins/processes/simulate-transaction/contract-error-matcher/types.ts";

/**
 * Stable error codes emitted by the contract-error matcher plugin.
 */
export enum Code {
  KNOWN_CONTRACT_ERROR_SIMULATION_FAILED = "PLG_SIM_CEM_001",
  DUPLICATE_CONTRACT_ERROR_CODE = "PLG_SIM_CEM_002",
}

/**
 * Metadata carried when the matcher recognizes a known contract error.
 *
 * The selected match describes the code, configured message, emitting contract,
 * invocation level, and matcher entry that produced the match.
 */
export type KnownContractErrorSimulationFailedMeta = {
  /** Known-error match selected by the plugin. */
  match: KnownContractErrorMatch;
};

/**
 * Base class for errors emitted by the contract-error matcher plugin.
 */
export abstract class ContractErrorMatcherPluginError<
  Data = unknown,
> extends PluginError<
  Code,
  Data
> {
  /** Source identifier for contract-error matcher plugin failures. */
  override readonly source =
    "@colibri/core/plugins/processes/simulate-transaction/contract-error-matcher";
}

/**
 * Raised when simulation fails with a contract error recognized by the plugin.
 *
 * Catch this error when you want application code to react to a known
 * contract-defined error using the human-facing mapping provided to the plugin.
 * If the selected mapping includes details, those details are used as the
 * diagnostic root cause.
 * The original `CONTRACT_ERROR_SIMULATION_FAILED` error is available as
 * `meta.cause` for deeper diagnostic inspection.
 */
export class KNOWN_CONTRACT_ERROR_SIMULATION_FAILED
  extends ContractErrorMatcherPluginError<
    KnownContractErrorSimulationFailedMeta
  > {
  /**
   * Creates a known contract-error simulation failure.
   *
   * @param cause - Original simulate-transaction contract-error failure.
   * @param match - Known contract-error match selected by the plugin.
   */
  constructor(
    cause: CONTRACT_ERROR_SIMULATION_FAILED,
    match: KnownContractErrorMatch,
  ) {
    super({
      code: Code.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
      message: `Contract error: ${match.message}`,
      details:
        `The transaction simulation failed with known contract error #${match.code}.`,
      diagnostic: {
        rootCause: match.details ??
          "A contract-defined error was recognized by the contract-error matcher plugin.",
        suggestion:
          "Inspect meta.data.match for the selected known error and meta.cause for the original simulation failure.",
      },
      cause,
      data: { match },
    });
  }
}

/**
 * Raised when a contract spec declares the same contract error code more than once.
 */
export class DUPLICATE_CONTRACT_ERROR_CODE
  extends ContractErrorMatcherPluginError<{ code: number }> {
  /**
   * Creates a duplicate contract-error-code failure.
   *
   * @param code - Numeric contract error code that appeared more than once.
   */
  constructor(code: number) {
    super({
      code: Code.DUPLICATE_CONTRACT_ERROR_CODE,
      message: `Duplicate contract error code: ${code}`,
      details:
        "The contract specification contains multiple error enum cases with the same numeric code.",
      diagnostic: {
        rootCause:
          "Contract error matching requires a one-to-one mapping between numeric codes and human-facing messages.",
        suggestion:
          "Fix the contract error enum or provide a manual matcher configuration with the intended mapping.",
      },
      data: { code },
    });
  }
}

/**
 * Contract-error matcher plugin error constructors indexed by stable code.
 */
export const ERROR_PLG_SIM_CEM = {
  [Code.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED]:
    KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
  [Code.DUPLICATE_CONTRACT_ERROR_CODE]: DUPLICATE_CONTRACT_ERROR_CODE,
};
