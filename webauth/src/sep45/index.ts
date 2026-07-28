/** SEP-45 protocol client. */
export { Sep45Client } from "@/sep45/client.ts";
/** Shared decoded/authenticated token representation. */
export { WebAuthToken } from "@/token.ts";
/** Immutable SEP-45 lifecycle states. */
export {
  Sep45AuthorizedChallenge,
  Sep45Challenge,
  Sep45PreparedChallenge,
} from "@/sep45/challenge.ts";
/** Contract-account authorization hook and conventional adapters. */
export {
  ContractAuth,
  type ContractAuthHandler,
} from "@/sep45/contract-auth.ts";
/** Exact SEP-45 authorization-entry codecs. */
export {
  cloneSep45AuthorizationEntry,
  decodeSep45AuthorizationEntries,
  encodeSep45AuthorizationEntries,
} from "@/sep45/codec.ts";
/** Pure draft SEP-45 v0.1.1 verification. */
export {
  hasSep45ClientDomainArguments,
  verifySep45Challenge,
} from "@/sep45/verify-challenge.ts";
/** Enforcing simulation and footprint validation. */
export {
  simulateSep45Challenge,
  validateSep45Footprint,
} from "@/sep45/simulation.ts";
/** Shared and SEP-45-specific error codes and classes. */
export { Sep45Code, Sep45Error, WebAuthCode, WebAuthError } from "@/error.ts";
export type {
  /** Context passed to a contract authorization handler. */
  ContractAuthContext,
  /** Protocol identifiers understood by WebAuth. */
  WebAuthProtocol,
  /** Challenge submission body encoding. */
  WebAuthSubmissionFormat,
} from "@/types.ts";
export type {
  Sep45AuthenticateOptions,
  Sep45AuthorizeChallengeOptions,
  Sep45ClientConfig,
  Sep45GetChallengeOptions,
  Sep45Rpc,
  Sep45SimulationReceipt,
  VerifiedSep45Challenge,
  VerifySep45ChallengeInput,
} from "@/sep45/types.ts";
