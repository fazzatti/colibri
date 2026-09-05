import {
  buildDataLedgerKey,
  isFeeBumpTransaction,
  isTransaction,
  LedgerEntries,
} from "@colibri/core";
import type { DataLedgerEntry } from "@colibri/core";
import { memoDestinations } from "@/destinations.ts";
import {
  type CheckMemoRequiredInput,
  SEP29_MEMO_REQUIRED_DATA_NAME,
} from "@/types.ts";
import * as E from "@/error.ts";

/**
 * Checks SEP-29 memo presence without modifying or submitting a transaction.
 *
 * Checks payments, both path-payment types, and account merges. Muxed
 * destinations are exempt. Any non-none memo satisfies this check, including
 * ID zero and empty text; the caller must still obtain the correct memo from
 * the recipient. Fee-bump envelopes use the inner transaction's memo.
 *
 * With no memo, reads each distinct relevant destination's account-data key
 * through RPC in one batch. Exactly the single ASCII byte `1` enables the
 * requirement. Missing accounts/data and other values do not enable it.
 * No network call is made if there is a memo or no relevant destinations.
 * Lookup failures reject rather than silently allowing submission. This reads
 * current ledger state, not future state or changes within this transaction.
 *
 * @throws {E.MEMO_REQUIRED} When a destination requires a missing memo.
 * @throws {E.INVALID_TRANSACTION} When the envelope type is unsupported.
 * @throws {E.FAILED_TO_CREATE_READER} When connection configuration is invalid.
 * @throws {E.FAILED_TO_READ_REQUIREMENTS} When RPC or decoding fails.
 */
export const checkMemoRequired = async (
  input: CheckMemoRequiredInput,
): Promise<void> => {
  const transaction = isFeeBumpTransaction(input.transaction)
    ? input.transaction.innerTransaction
    : input.transaction;
  if (!isTransaction(transaction)) throw new E.INVALID_TRANSACTION();
  if (transaction.memo.type !== "none") return;
  const destinations = memoDestinations(transaction);
  if (!destinations.length) return;

  let reader: LedgerEntries;
  try {
    reader = new LedgerEntries(input);
  } catch (cause) {
    throw new E.FAILED_TO_CREATE_READER(cause);
  }
  let entries: (DataLedgerEntry | null)[];
  try {
    entries = await reader.getMany(
      destinations.map(({ destination }) =>
        buildDataLedgerKey({
          accountId: destination,
          dataName: SEP29_MEMO_REQUIRED_DATA_NAME,
        })
      ),
    );
  } catch (cause) {
    throw new E.FAILED_TO_READ_REQUIREMENTS(
      destinations.map(({ destination }) => destination),
      cause,
    );
  }
  for (const [index, entry] of entries.entries()) {
    if (entry?.dataValue.length === 1 && entry.dataValue[0] === 49) {
      const { destination, operationIndex } = destinations[index];
      throw new E.MEMO_REQUIRED(destination, operationIndex);
    }
  }
};
