import * as AssembleForEnforcementErrors from "@/processes/assemble-for-enforcement/error.ts";
import * as AssembleTransactionErrors from "@/processes/assemble-transaction/error.ts";
import * as BuildTransactionErrors from "@/processes/build-transaction/error.ts";
import * as EnforceSimulationErrors from "@/processes/enforce-simulation/error.ts";
import * as EnvelopeSigningRequirementsErrors from "@/processes/envelope-signing-requirements/error.ts";
import * as SendTransactionErrors from "@/processes/send-transaction/error.ts";
import * as SignAuthEntriesErrors from "@/processes/sign-auth-entries/error.ts";
import * as SignEnvelopeErrors from "@/processes/sign-envelope/error.ts";
import * as SimulateTransactionErrors from "@/processes/simulate-transaction/error.ts";
import * as WrapFeeBumpErrors from "@/processes/wrap-fee-bump/error.ts";
import * as ParseClassicTransactionOutcomeErrors from "@/processes/parse-classic-transaction-outcome/error.ts";

export * from "@/processes/assemble-transaction/index.ts";
/** Error constructors for assemble-transaction process failures. */
export const ASM_ERRORS: typeof AssembleTransactionErrors =
  AssembleTransactionErrors;
export * from "@/processes/assemble-transaction/types.ts";

export * from "@/processes/build-transaction/index.ts";
/** Error constructors for build-transaction process failures. */
export const BTX_ERRORS: typeof BuildTransactionErrors = BuildTransactionErrors;
export type * from "@/processes/build-transaction/types.ts";

export * from "@/processes/envelope-signing-requirements/index.ts";
/** Error constructors for envelope-signing-requirements process failures. */
export const ESR_ERRORS: typeof EnvelopeSigningRequirementsErrors =
  EnvelopeSigningRequirementsErrors;
export type * from "@/processes/envelope-signing-requirements/types.ts";

export * from "@/processes/send-transaction/index.ts";
/** Error constructors for send-transaction process failures. */
export const STX_ERRORS: typeof SendTransactionErrors = SendTransactionErrors;
export type * from "@/processes/send-transaction/types.ts";

export * from "@/processes/sign-auth-entries/index.ts";
/** Error constructors for sign-auth-entries process failures. */
export const SAE_ERRORS: typeof SignAuthEntriesErrors = SignAuthEntriesErrors;
export type * from "@/processes/sign-auth-entries/types.ts";

export * from "@/processes/assemble-for-enforcement/index.ts";
/** Error constructors for assembly-for-enforcement process failures. */
export const AFE_ERRORS: typeof AssembleForEnforcementErrors =
  AssembleForEnforcementErrors;
export type * from "@/processes/assemble-for-enforcement/types.ts";

export * from "@/processes/enforce-simulation/index.ts";
/** Error constructors for enforcing-simulation process failures. */
export const EFS_ERRORS: typeof EnforceSimulationErrors =
  EnforceSimulationErrors;
export type * from "@/processes/enforce-simulation/types.ts";

export * from "@/processes/sign-envelope/index.ts";
/** Error constructors for sign-envelope process failures. */
export const SEN_ERRORS: typeof SignEnvelopeErrors = SignEnvelopeErrors;
export type * from "@/processes/sign-envelope/types.ts";

export * from "@/processes/simulate-transaction/index.ts";
/** Error constructors for simulate-transaction process failures. */
export const SIM_ERRORS: typeof SimulateTransactionErrors =
  SimulateTransactionErrors;
export type * from "@/processes/simulate-transaction/types.ts";

export * from "@/processes/wrap-fee-bump/index.ts";
/** Error constructors for wrap-fee-bump process failures. */
export const WFB_ERRORS: typeof WrapFeeBumpErrors = WrapFeeBumpErrors;
export type * from "@/processes/wrap-fee-bump/types.ts";

export * from "@/processes/parse-classic-transaction-outcome/index.ts";
/** Error constructors for classic transaction outcome parsing failures. */
export const PCTO_ERRORS: typeof ParseClassicTransactionOutcomeErrors =
  ParseClassicTransactionOutcomeErrors;
export type * from "@/processes/parse-classic-transaction-outcome/types.ts";
