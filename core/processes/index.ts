import * as PostAuthAssembleErrors from "@/processes/post-auth-assemble-transaction/error.ts";
import * as PostAuthEnforcedSimulationErrors from "@/processes/post-auth-enforced-simulation/error.ts";

export * from "@/processes/assemble-transaction/index.ts";
/** Error constructors for assemble-transaction process failures. */
export * as ASM_ERRORS from "@/processes/assemble-transaction/error.ts";
export * from "@/processes/assemble-transaction/types.ts";

export * from "@/processes/build-transaction/index.ts";
/** Error constructors for build-transaction process failures. */
export * as BTX_ERRORS from "@/processes/build-transaction/error.ts";
export type * from "@/processes/build-transaction/types.ts";

export * from "@/processes/envelope-signing-requirements/index.ts";
/** Error constructors for envelope-signing-requirements process failures. */
export * as ESR_ERRORS from "@/processes/envelope-signing-requirements/error.ts";
export type * from "@/processes/envelope-signing-requirements/types.ts";

export * from "@/processes/send-transaction/index.ts";
/** Error constructors for send-transaction process failures. */
export * as STX_ERRORS from "@/processes/send-transaction/error.ts";
export type * from "@/processes/send-transaction/types.ts";

export * from "@/processes/sign-auth-entries/index.ts";
/** Error constructors for sign-auth-entries process failures. */
export * as SAE_ERRORS from "@/processes/sign-auth-entries/error.ts";
export type * from "@/processes/sign-auth-entries/types.ts";

export * from "@/processes/post-auth-assemble-transaction/index.ts";
/** Error constructors for post-auth assembly process failures. */
export const PAA_ERRORS: typeof PostAuthAssembleErrors = PostAuthAssembleErrors;
export type * from "@/processes/post-auth-assemble-transaction/types.ts";

export * from "@/processes/post-auth-enforced-simulation/index.ts";
/** Error constructors for post-auth enforcing-simulation process failures. */
export const PAE_ERRORS: typeof PostAuthEnforcedSimulationErrors =
  PostAuthEnforcedSimulationErrors;
export type * from "@/processes/post-auth-enforced-simulation/types.ts";

export * from "@/processes/sign-envelope/index.ts";
/** Error constructors for sign-envelope process failures. */
export * as SEN_ERRORS from "@/processes/sign-envelope/error.ts";
export type * from "@/processes/sign-envelope/types.ts";

export * from "@/processes/simulate-transaction/index.ts";
/** Error constructors for simulate-transaction process failures. */
export * as SIM_ERRORS from "@/processes/simulate-transaction/error.ts";
export type * from "@/processes/simulate-transaction/types.ts";

export * from "@/processes/wrap-fee-bump/index.ts";
/** Error constructors for wrap-fee-bump process failures. */
export * as WFB_ERRORS from "@/processes/wrap-fee-bump/error.ts";
export type * from "@/processes/wrap-fee-bump/types.ts";
