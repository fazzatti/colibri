/** SEP-10 protocol client. */
export { Sep10Client } from "@/sep10/client.ts";
/** Shared decoded/authenticated token representation. */
export { WebAuthToken } from "@/token.ts";
/** Immutable SEP-10 lifecycle states. */
export { Sep10Challenge, Sep10SignedChallenge } from "@/sep10/challenge.ts";
/** Pure SEP-10 challenge verification. */
export {
  hasSep10ClientDomainOperation,
  verifySep10Challenge,
} from "@/sep10/verify-challenge.ts";
/** Shared and SEP-10-specific error codes and classes. */
export { Sep10Code, Sep10Error, WebAuthCode, WebAuthError } from "@/error.ts";
export type {
  /** Protocol identifiers understood by WebAuth. */
  WebAuthProtocol,
  /** Challenge submission body encoding. */
  WebAuthSubmissionFormat,
} from "@/types.ts";
export type {
  Sep10AuthenticateOptions,
  Sep10ClientConfig,
  Sep10GetChallengeOptions,
  VerifiedSep10Challenge,
  VerifySep10ChallengeInput,
} from "@/sep10/types.ts";
