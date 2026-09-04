/**
 * Colibri's transaction, contract, authorization, event, and ledger toolkit.
 *
 * @module
 */

import * as NativeAccountErrors from "@/account/native/error.ts";
import * as AddressHelpers from "@/address/index.ts";
import * as AuthHelpers from "@/auth/index.ts";
import * as ContractErrors from "@/contract/error.ts";
import * as LedgerParserErrors from "@/ledger-parser/error.ts";
import * as LedgerEntryErrors from "@/ledger-entries/error.ts";
import * as StepFactories from "@/steps/index.ts";
import * as Sep1Errors from "@/sep1/error.ts";

export * from "@/account/native/index.ts";
export type * from "@/account/types.ts";
export type * from "@/account/native/types.ts";
/** Error constructors for native account helpers. */
export const ERRORS_ACC_NAT: typeof NativeAccountErrors = NativeAccountErrors;

export * from "@/asset/index.ts";
/** Address helpers for parsing and normalization. */
export const address: typeof AddressHelpers = AddressHelpers;
/** Authorization helpers and requirements. */
export const auth: typeof AuthHelpers = AuthHelpers;

export * from "@/common/index.ts";

export * from "@/contract/index.ts";
export type * from "@/contract/types.ts";
/** Error constructors for contract helpers. */
export const ERRORS_CONTR: typeof ContractErrors = ContractErrors;

export * from "@/error/index.ts";
export * from "@/error/types.ts";

export * from "@/event/index.ts";
export * from "@/event/types.ts";

export * from "@/ledger-parser/index.ts";
/** Error constructors for ledger parser helpers. */
export const ERRORS_LDP: typeof LedgerParserErrors = LedgerParserErrors;

export * from "@/ledger-entries/index.ts";
/** Error constructors for ledger entry access helpers. */
export const ERRORS_LDE: typeof LedgerEntryErrors = LedgerEntryErrors;

export * from "@/network/index.ts";
export * from "@/network/types.ts";

export * from "@/processes/index.ts";
/** Reusable pipeline step factories. */
export const steps: typeof StepFactories = StepFactories;

export * from "@/pipelines/index.ts";

export * from "@/plugins/index.ts";

export type * from "@/signer/types.ts";
export * from "@/signer/local/index.ts";
export * from "@/signer/delegated/index.ts";
export * from "@/signer/hash-x/index.ts";
export * from "@/signer/pre-authorized-transaction/index.ts";
export * from "@/signer/signed-payload/index.ts";

export * from "@/strkeys/index.ts";
export type * from "@/strkeys/types.ts";

export * from "@/toid/index.ts";
export type * from "@/toid/types.ts";

export * from "@/tools/index.ts";

export * from "@/sep1/index.ts";
export type * from "@/sep1/types.ts";
/** Error constructors for SEP-1 helpers. */
export const ERRORS_SEP1: typeof Sep1Errors = Sep1Errors;
