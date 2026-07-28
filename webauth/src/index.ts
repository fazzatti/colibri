/** Unified WebAuth client. */
export { WebAuthClient } from "@/client.ts";
export * from "@/token.ts";
/** Shared and protocol-specific typed errors. */
export {
  Sep10Code,
  Sep10Error,
  Sep45Code,
  Sep45Error,
  WebAuthCode,
  WebAuthError,
  type WebAuthErrorCode,
  type WebAuthErrorMeta,
  type WebAuthErrorOptions,
} from "@/error.ts";
/** Account-to-protocol routing helper. */
export { protocolForAccount } from "@/routing.ts";

export * from "@/sep10/index.ts";
export * from "@/sep45/index.ts";

export type {
  ContractAuthContext,
  Sep10AuthenticationOptions,
  Sep45AuthenticationOptions,
  WebAuthAuthenticationOptions,
  WebAuthClientConfig,
  WebAuthConstructionOptions,
  WebAuthProtocol,
  WebAuthSubmissionFormat,
} from "@/types.ts";
