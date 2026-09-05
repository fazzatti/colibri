import type { Ledger } from "@/native-types.ts";
import { transactionRecords } from "@/variants/transaction/records.ts";
import type { StreamedOperation } from "@/variants/operation/types.ts";

/** Preserves transaction and operation order, including failed transaction intents. @internal */
export function operationRecords(ledger: Ledger): StreamedOperation[] {
  return transactionRecords(ledger).flatMap((record) =>
    record.transaction.operations.map((parsedOperation) => ({
      ...record,
      operationIndex: parsedOperation.index,
      operation: parsedOperation.toOperation(),
      parsedOperation,
    }))
  );
}
