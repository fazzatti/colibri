import { Transaction } from "stellar-sdk";
import type { TransactionFee } from "@/common/types/transaction-config/types.ts";

export const MINIMUM_BASE_FEE = 100n;
export const MAXIMUM_TRANSACTION_FEE = 0xffff_ffffn;

export type TransactionFeeMode = keyof TransactionFee;

export type ParsedTransactionFee = {
  mode: TransactionFeeMode;
  amount: bigint;
};

export type TransactionFeeParseError =
  | { reason: "invalid-configuration" }
  | { reason: "invalid-amount"; mode: TransactionFeeMode; value: unknown };

export type TransactionFeeParseResult =
  | { ok: true; value: ParsedTransactionFee }
  | { ok: false; error: TransactionFeeParseError };

const TRANSACTION_FEE_MODES = ["base", "inclusion", "max"] as const;

export const parseTransactionFee = (
  fee: unknown,
): TransactionFeeParseResult => {
  if (!fee || typeof fee !== "object" || Array.isArray(fee)) {
    return { ok: false, error: { reason: "invalid-configuration" } };
  }

  const keys = Object.keys(fee);
  if (
    keys.length !== 1 ||
    !TRANSACTION_FEE_MODES.includes(keys[0] as TransactionFeeMode)
  ) {
    return { ok: false, error: { reason: "invalid-configuration" } };
  }

  const mode = keys[0] as TransactionFeeMode;
  const value = (fee as Record<TransactionFeeMode, unknown>)[mode];
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return { ok: false, error: { reason: "invalid-amount", mode, value } };
  }

  return { ok: true, value: { mode, amount: BigInt(value) } };
};

export const getTransactionResourceFee = (
  transaction: Transaction,
): bigint =>
  transaction.toEnvelope().v1().tx().ext().value()?.resourceFee().toBigInt() ??
    0n;

export const getTransactionInclusionFee = (
  transaction: Transaction,
): bigint => BigInt(transaction.fee) - getTransactionResourceFee(transaction);

export const setTransactionFee = (
  transaction: Transaction,
  fee: bigint,
): Transaction => {
  const envelope = transaction.toEnvelope();
  envelope.v1().tx().fee(Number(fee));

  return new Transaction(envelope, transaction.networkPassphrase);
};
