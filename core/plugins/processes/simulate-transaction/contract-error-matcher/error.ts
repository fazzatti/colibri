import { PluginError } from "@/plugins/error.ts";
import type { CONTRACT_ERROR_SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import type { KnownContractErrorMatch } from "@/plugins/processes/simulate-transaction/contract-error-matcher/types.ts";

/**
 * Stable error codes emitted by the contract-error matcher plugin.
 */
export enum Code {
  KNOWN_CONTRACT_ERROR_SIMULATION_FAILED = "PLG_SIM_CEM_001",
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
export abstract class ContractErrorMatcherPluginError extends PluginError<
  Code,
  KnownContractErrorSimulationFailedMeta
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
 * The original `CONTRACT_ERROR_SIMULATION_FAILED` error is available as
 * `meta.cause` for deeper diagnostic inspection.
 */
export class KNOWN_CONTRACT_ERROR_SIMULATION_FAILED
  extends ContractErrorMatcherPluginError {
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
        rootCause:
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
 * Contract-error matcher plugin error constructors indexed by stable code.
 */
export const ERROR_PLG_SIM_CEM = {
  [Code.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED]:
    KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
};
