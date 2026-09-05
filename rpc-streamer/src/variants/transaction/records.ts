import type { Ledger } from "@/native-types.ts";
import type { StreamedTransaction } from "@/variants/transaction/types.ts";

/** Builds records in transaction-processing order, preserving failed transactions. @internal */
export function transactionRecords(ledger: Ledger): StreamedTransaction[] {
  return ledger.transactions.map((transaction) => ({
    ledgerSequence: ledger.sequence,
    ledgerHash: ledger.hash,
    ledgerCloseTime: ledger.ledgerCloseTime,
    transactionHash: transaction.hash,
    transactionIndex: transaction.index,
    transactionStatus: transaction.successful ? "success" : "failed",
    transaction,
  }));
}
