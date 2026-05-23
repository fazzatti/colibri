import { plugin } from "convee";
import type { CONTRACT_ERROR_SIMULATION_FAILED } from "@/processes/simulate-transaction/error.ts";
import {
  CONTRACT_ERROR_SIMULATION_FAILED as ContractErrorSimulationFailed,
} from "@/processes/simulate-transaction/error.ts";
import { SIMULATE_TRANSACTION_STEP_ID } from "@/steps/ids.ts";
import * as E from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
import type {
  ContractErrorMatcher,
  ContractErrorMatcherCandidate,
  ContractErrorMatcherPlugin,
  ContractErrorMatcherPluginConfig,
  KnownContractErrorMatch,
} from "@/plugins/processes/simulate-transaction/contract-error-matcher/types.ts";

/**
 * Stable plugin id for the contract-error matcher.
 *
 * Use this id when you need to identify the built-in plugin in custom pipeline
 * tooling or diagnostics.
 */
export const CONTRACT_ERROR_MATCHER_PLUGIN_ID = "contract-error-matcher";

/**
 * Step id targeted by the contract-error matcher plugin.
 *
 * The plugin runs on the simulate-transaction step because contract errors are
 * surfaced by RPC simulation before a Soroban transaction is assembled or sent.
 */
export const CONTRACT_ERROR_MATCHER_PLUGIN_TARGET: "simulate-transaction" =
  SIMULATE_TRANSACTION_STEP_ID;

/**
 * Creates a plugin that rewrites recognized contract simulation failures.
 *
 * The plugin listens for `CONTRACT_ERROR_SIMULATION_FAILED` errors emitted by
 * the simulate-transaction process. When the parsed contract-error stack
 * matches the configured code map or matcher list, the plugin throws
 * `KNOWN_CONTRACT_ERROR_SIMULATION_FAILED` with the configured human-facing
 * message and optional details. The original process error remains available
 * as `meta.cause`.
 *
 * Attach this plugin directly to an invoke/read pipeline for advanced
 * orchestration. High-level `Contract` users can also pass plugins explicitly
 * through `contractConfig.plugins` or call
 * `contract.loadContractErrorsFromWasm(...)` to derive a mapping from the
 * loaded contract spec or WASM.
 *
 * @param config - A simple error-code map or ordered matcher list.
 * @returns A plugin targeting the simulate-transaction step.
 *
 * @example Attach a simple code map to a pipeline.
 * ```ts
 * import {
 *   createContractErrorMatcherPlugin,
 *   createInvokeContractPipeline,
 * } from "@colibri/core";
 *
 * const pipe = createInvokeContractPipeline({ networkConfig });
 * pipe.use(createContractErrorMatcherPlugin({
 *   1: {
 *     message: "Unauthorized",
 *     details: "The caller is not authorized to run this operation.",
 *   },
 * }));
 * ```
 */
export const createContractErrorMatcherPlugin = (
  config: ContractErrorMatcherPluginConfig,
): ContractErrorMatcherPlugin => {
  const matchers = normalizeMatchers(config);

  return plugin({
    id: CONTRACT_ERROR_MATCHER_PLUGIN_ID,
    target: CONTRACT_ERROR_MATCHER_PLUGIN_TARGET,
  }).onError((error: Error): Error => {
    if (!(error instanceof ContractErrorSimulationFailed)) return error;

    const match = getKnownContractErrorMatch(error, matchers);
    if (!match) return error;

    return new E.KNOWN_CONTRACT_ERROR_SIMULATION_FAILED(error, match);
  }) as unknown as ContractErrorMatcherPlugin;
};

const normalizeMatchers = (
  config: ContractErrorMatcherPluginConfig,
): readonly ContractErrorMatcher[] =>
  isMatcherList(config) ? config : [{ strategy: "any", errors: config }];

const isMatcherList = (
  config: ContractErrorMatcherPluginConfig,
): config is readonly ContractErrorMatcher[] => Array.isArray(config);

const getKnownContractErrorMatch = (
  error: CONTRACT_ERROR_SIMULATION_FAILED,
  matchers: readonly ContractErrorMatcher[],
): KnownContractErrorMatch | null => {
  for (const [matcherIndex, matcher] of matchers.entries()) {
    for (const candidate of error.meta.data.contractErrorStack) {
      if (!matchesStrategy(candidate, matcher)) continue;

      const knownError = matcher.errors[candidate.code];
      if (!knownError) continue;

      return {
        code: candidate.code,
        message: knownError.message,
        details: knownError.details,
        contractId: candidate.contractId,
        issuedFrom: candidate.issuedFrom,
        eventIndex: candidate.eventIndex,
        strategy: matcher.strategy,
        matcherIndex,
      };
    }
  }

  return null;
};

const matchesStrategy = (
  candidate: ContractErrorMatcherCandidate,
  matcher: ContractErrorMatcher,
): boolean => {
  if (matcher.strategy === "any") return true;
  if (matcher.strategy === "contract-id") {
    return candidate.contractId === matcher.contractId;
  }

  return candidate.issuedFrom === matcher.issuedFrom;
};

export { ERROR_PLG_SIM_CEM } from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
export * from "@/plugins/processes/simulate-transaction/contract-error-matcher/error.ts";
export { extractContractErrorMapFromWasm } from "@/plugins/processes/simulate-transaction/contract-error-matcher/helpers.ts";
export type * from "@/plugins/processes/simulate-transaction/contract-error-matcher/types.ts";
