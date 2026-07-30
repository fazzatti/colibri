import * as authEntries from "@/common/helpers/xdr/auth-entries.ts";
import { getAddressTypeFromAuthEntry } from "@/common/helpers/xdr/get-address-type-from-auth-entry.ts";
import { getAddressSignerFromAuthEntry } from "@/common/helpers/xdr/get-address-signer-from-auth-entry.ts";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { getAuthEntrySignatures } from "@/common/helpers/xdr/get-auth-entry-signatures.ts";
import { operationHasDelegatedAuthorization } from "@/common/helpers/xdr/operation-has-delegated-authorization.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";
import { parseEvents } from "@/common/helpers/xdr/parse-events.ts";
import { parseErrorResult } from "@/common/helpers/xdr/parse-error-result.ts";

/** Aggregated XDR helper namespace. */
export const xdr = {
  ...authEntries,
  getAddressTypeFromAuthEntry,
  getAddressSignerFromAuthEntry,
  getAddressCredentialsFromAuthEntry,
  getAuthEntrySignatures,
  operationHasDelegatedAuthorization,
  softTryToXDR,
  parseEvents,
  parseErrorResult,
};

export * from "@/common/helpers/xdr/ensure-xdr-type.ts";
export * from "@/common/helpers/xdr/parse-asset.ts";
export * from "@/common/helpers/xdr/parse-change-trust-asset.ts";
export * from "@/common/helpers/xdr/parse-account-id.ts";
export * from "@/common/helpers/xdr/parse-muxed-account.ts";
export * from "@/common/helpers/xdr/get-address-type-from-auth-entry.ts";
export * from "@/common/helpers/xdr/get-address-signer-from-auth-entry.ts";
export * from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
export * from "@/common/helpers/xdr/get-auth-entry-signatures.ts";
export * from "@/common/helpers/xdr/operation-has-delegated-authorization.ts";
export * from "@/common/helpers/xdr/soft-try-to-xdr.ts";
export * from "@/common/helpers/xdr/parse-events.ts";
export * from "@/common/helpers/xdr/parse-error-result.ts";
export * from "@/common/helpers/xdr/scval.ts";

export type * from "@/common/helpers/xdr/types.ts";
