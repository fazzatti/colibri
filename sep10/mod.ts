/**
 * @module @colibri/sep10
 *
 * SEP-10 Web Authentication for Stellar
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

// Implementation
export * from "@/index.ts";

// Types
export type {
  BuildChallengeOptions,
  VerifyChallengeOptions,
  ChallengeOperation,
  ChallengeTimeBounds,
  ParsedChallenge,
  SignerFn,
  Sep10ClientConfig,
  GetChallengeOptions,
  AuthenticateOptions,
} from "@/types.ts";
