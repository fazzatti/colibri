import { FeeBumpTransaction, Transaction, type xdr } from "stellar-sdk";
import { ColibriError } from "@/error/index.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

enum ErrorCode {
  FAILED_TO_GET_TRANSACTION_TIMEOUT = "HLP_TX_01",
  FAILED_TO_GET_OPERATIONS_FROM_TRANSACTION = "HLP_TX_02",
}

const baseErrorSource = "@colibri/core/helpers/transaction";

/** Returns the remaining transaction timeout in seconds or milliseconds. */
export const getTransactionTimeout = (
  tx: Transaction | FeeBumpTransaction,
  unit: "seconds" | "milliseconds" = "seconds"
): number | undefined => {
  try {
    if (tx instanceof FeeBumpTransaction && "innerTransaction" in tx)
      tx = tx.innerTransaction;

    if (tx instanceof Transaction) {
      const txTimeout = Number(tx.timeBounds?.maxTime || 0);
      return txTimeout > 0
        ? unit === "milliseconds"
          ? (txTimeout - Math.floor(Date.now() / 1000)) * 1000
          : txTimeout - Math.floor(Date.now() / 1000)
        : undefined;
    }

    throw new Error(`Unexpected transaction type!`);
  } catch (e) {
    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/getTransactionTimeout",
      message:
        "Failed to get transaction timeout from Transaction or FeeBumpTransaction!",
      code: ErrorCode.FAILED_TO_GET_TRANSACTION_TIMEOUT,
      meta: {
        data: {
          txXDR: softTryToXDR(() => tx.toXDR()),
        },
      },
    });
  }
};

/** Extracts classic operations from a built transaction envelope. */
export const getOperationsFromTransaction = (
  transaction: Transaction
): xdr.Operation[] => {
  try {
    return transaction.toEnvelope().v1().tx().operations();
  } catch (e) {
    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/getOperationsFromTransaction",
      message: "Failed to get operations from Transaction!",
      code: ErrorCode.FAILED_TO_GET_OPERATIONS_FROM_TRANSACTION,
      meta: {
        data: {
          txXDR: softTryToXDR(() => transaction.toXDR()),
        },
      },
    });
  }
};

/** Returns the Stellar operation type name for a raw operation. */
export const getOperationType = (op: xdr.Operation): string => {
  return op.body().switch().name;
};

/** Returns the ordered list of operation type names contained in a transaction. */
export const getOperationTypesFromTransaction = (
  transaction: Transaction
): string[] => {
  return getOperationsFromTransaction(transaction).map(getOperationType);
};
