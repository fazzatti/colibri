import { FeeBumpTransaction, Transaction } from "stellar-sdk";
import { ColibriError } from "../../error/index.ts";
import { softTryToXDR } from "./xdr.ts";

enum ErrorCode {
  FAILED_TO_GET_TRANSACTION_TIMEOUT = "HLP_TX_01",
}

const baseErrorSource = "@colibri/core/helpers/transaction";

export const getTransactionTimeout = (
  tx: Transaction | FeeBumpTransaction,
  unit: "seconds" | "milliseconds" = "seconds"
): number | undefined => {
  try {
    if (tx instanceof FeeBumpTransaction && "innerTransaction" in tx)
      tx = tx.innerTransaction;

    if (tx instanceof Transaction) {
      const txTimeout = Number(tx.timeBounds?.maxTime) ?? 0;
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
