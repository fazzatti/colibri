import type { xdr } from "stellar-sdk";
import type { TransactionSource } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

/** Inputs for a native begin/operations/end reserve-sponsorship block. */
export type WrapSponsorshipArgs = {
  /** Account paying the sponsored reserves; an explicit G or M operation source. */
  sponsor: TransactionSource;
  /** G account accepting reserve sponsorship, including an account being created. */
  sponsored: Ed25519PublicKey;
  /** Native operations, preserved in order without rewriting their sources. */
  operations: readonly xdr.Operation[];
};
