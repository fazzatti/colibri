/**
 * @module @colibri/sep10
 *
 * SEP-10 Web Authentication for Stellar
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

// Challenge
export { SEP10Challenge } from "@/challenge/challenge.ts";
export * as ChallengeErrors from "@/challenge/error.ts";
export { ERROR_SEP10_CHAL } from "@/challenge/error.ts";

// Client (future)
export * as ClientErrors from "@/client/error.ts";
export { ERROR_SEP10_CLI } from "@/client/error.ts";

// Types
export type {
  BuildChallengeOptions,
  VerifyChallengeOptions,
  ChallengeOperation,
  ChallengeTimeBounds,
  ParsedChallenge,
  SignerFn,
} from "@/types.ts";
