import { errorContext } from "@/common/helpers/error-context.ts";
import type { BaseMeta, ColibriErrorShape } from "@/error/types.ts";
import { FeeBumpTransaction, Transaction, type xdr } from "stellar-sdk";
import { ColibriError } from "@/error/index.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

/** Stable helper failure codes. */
export enum TransactionCode {
  FAILED_TO_GET_TRANSACTION_TIMEOUT = "HLP_TX_01",
  FAILED_TO_GET_OPERATIONS_FROM_TRANSACTION = "HLP_TX_02",
}

const baseErrorSource = "@colibri/core/helpers/transaction";

/** Returns the remaining transaction timeout in seconds or milliseconds. */
export const getTransactionTimeout = (
  tx: Transaction | FeeBumpTransaction,
  unit: "seconds" | "milliseconds" = "seconds",
): number | undefined => {
  const timeoutContext = {
    domain: "helpers" as const,
    source: baseErrorSource + "/getTransactionTimeout",
    message:
      "Failed to get transaction timeout from Transaction or FeeBumpTransaction!",
    code: TransactionCode.FAILED_TO_GET_TRANSACTION_TIMEOUT,
    meta: {
      data: {
        txXDR: softTryToXDR(() => tx.toXdr()),
      },
    },
  };

  try {
    if (tx instanceof FeeBumpTransaction && "innerTransaction" in tx) {
      tx = tx.innerTransaction;
    }

    if (tx instanceof Transaction) {
      const txTimeout = Number(tx.timeBounds?.maxTime || 0);
      return txTimeout > 0
        ? unit === "milliseconds"
          ? (txTimeout - Math.floor(Date.now() / 1000)) * 1000
          : txTimeout - Math.floor(Date.now() / 1000)
        : undefined;
    }

    throw new FailedToGetTransactionTimeoutError({
      ...timeoutContext,
      details:
        "The provided value is not a supported Transaction or FeeBumpTransaction instance.",
    });
  } catch (e) {
    throw (e instanceof ColibriError
      ? e
      : new FailedToGetTransactionTimeoutError(
        errorContext(e, timeoutContext),
      ));
  }
};

/** Extracts classic operations from a built transaction envelope. */
export const getOperationsFromTransaction = (
  transaction: Transaction,
): xdr.Operation[] => {
  try {
    return transaction.tx.operations;
  } catch (e) {
    throw (e instanceof ColibriError
      ? e
      : new FailedToGetOperationsFromTransactionError(errorContext(e, {
        domain: "helpers",
        source: baseErrorSource + "/getOperationsFromTransaction",
        message: "Failed to get operations from Transaction!",

        meta: {
          data: {
            txXDR: softTryToXDR(() => transaction.toXdr()),
          },
        },
      })));
  }
};

/** Returns the Stellar operation type name for a raw operation. */
export const getOperationType = (op: xdr.Operation): string => {
  return op.body.type;
};

/** Returns the ordered list of operation type names contained in a transaction. */
export const getOperationTypesFromTransaction = (
  transaction: Transaction,
): string[] => {
  return getOperationsFromTransaction(transaction).map(getOperationType);
};

/** Failed to get transaction timeout. Stable code `HLP_TX_01`. */
export class FailedToGetTransactionTimeoutError
  extends ColibriError<TransactionCode.FAILED_TO_GET_TRANSACTION_TIMEOUT> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      code: TransactionCode.FAILED_TO_GET_TRANSACTION_TIMEOUT,
    });
  }
}

/** Failed to get operations from transaction. Stable code `HLP_TX_02`. */
export class FailedToGetOperationsFromTransactionError extends ColibriError<
  TransactionCode.FAILED_TO_GET_OPERATIONS_FROM_TRANSACTION
> {
  /** Preserve diagnostics while fixing this failure's code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({
      ...context,
      code: TransactionCode.FAILED_TO_GET_OPERATIONS_FROM_TRANSACTION,
    });
  }
}
