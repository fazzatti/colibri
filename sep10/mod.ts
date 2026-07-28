/**
 * @module @colibri/sep10
 *
 * SEP-10 Web Authentication for Stellar
 *
 * @deprecated This package is frozen. Use `@colibri/webauth`.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

// Implementation
export * from "@/index.ts";

// Types
export type {
  AuthenticateOptions,
  BuildChallengeOptions,
  ChallengeOperation,
  ChallengeTimeBounds,
  GetChallengeOptions,
  ParsedChallenge,
  Sep10ClientConfig,
  SignerFn,
  VerifyChallengeOptions,
} from "@/types.ts";
