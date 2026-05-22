import { regex } from "@/common/regex/index.ts";
import { createTOID, isTOID, parseTOID } from "@/toid/index.ts";
import type { TOID } from "@/toid/types.ts";
import { assert } from "@/common/assert/assert.ts";
import * as E from "@/event/event-id/error.ts";
/**
 * Unique Colibri identifier for one event emitted by an operation.
 *
 * This is not a SEP-0035 operation ID by itself. It combines the operation's
 * 19-character zero-padded TOID with a 10-character zero-padded event index.
 *
 * Format: 19-character TOID + hyphen + 10-character event index.
 * Example: 0000000000000123456-0000000001
 */
export type EventId = `${bigint}-${bigint}` & { __brand: "EventId" };

/**
 * Checks if a string is a valid Event ID.
 *
 * @param id - The string to validate.
 * @returns True if the string is a valid Event ID, false otherwise.
 */
export function isEventId(id: string): id is EventId {
  if (!regex.eventId.test(id)) return false;

  const [toidPart] = id.split("-");
  return isTOID(toidPart);
}

/**
 * Creates an Event ID from an operation TOID and an event index.
 *
 * @param toid - Operation ID for the operation that emitted this event.
 * @param eventIndex - Index of the event within the operation, as a 1-based input converted to 0-based output.
 * @returns A formatted Event ID string.
 *
 * @example
 * const eventId = createEventId("0000530242871959552" as TOID, 1);
 * // Returns: "0000530242871959552-0000000000"
 */
export function createEventId(toid: TOID, eventIndex: number): EventId {
  assert(
    eventIndex >= 1 && eventIndex <= 9999999999,
    new E.EVENT_INDEX_OUT_OF_RANGE(eventIndex),
  );

  // Shift to 0-based for output (matches RPC behavior)
  const eventIndex0 = eventIndex - 1;

  const toidPadded = toid.padStart(19, "0");
  const eventIndexPadded = eventIndex0.toString().padStart(10, "0");

  return `${toidPadded}-${eventIndexPadded}` as EventId;
}

/**
 * Creates an Event ID directly from ledger, transaction, operation, and event
 * components.
 *
 * This is a convenience function that combines createTOID and createEventId.
 *
 * @param ledgerSequence - Ledger sequence number.
 * @param transactionOrder - Transaction application order, as a 1-based value.
 * @param operationIndex - Operation index, as a 1-based value.
 * @param eventIndex - Event index within the operation, as a 1-based input converted to 0-based output.
 * @returns A formatted Event ID string.
 *
 * @example
 * const eventId = createEventIdFromParts(123456, 1, 1, 1);
 * // Returns: "0000530242871959552-0000000000"
 */
export function createEventIdFromParts(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number,
  eventIndex: number,
): EventId {
  const toid = createTOID(ledgerSequence, transactionOrder, operationIndex);
  return createEventId(toid, eventIndex);
}

/**
 * Parses an Event ID back into its component parts.
 *
 * @param eventId - A valid Event ID string
 * @returns Object containing the TOID components and the stored 0-based event index.
 * @throws Error if the Event ID is invalid
 *
 * @example
 * const parts = parseEventId("0000530239482499072-0000000000");
 * // Returns: { ledgerSequence: 123456, transactionOrder: 1, operationIndex: 1, eventIndex: 0 }
 */
export function parseEventId(eventId: string): {
  ledgerSequence: number;
  transactionOrder: number;
  operationIndex: number;
  eventIndex: number;
} {
  assert(isEventId(eventId), new E.INVALID_EVENT_ID_FORMAT(eventId));

  const [toidPart, eventIndexPart] = eventId.split("-");
  const toidComponents = parseTOID(toidPart);
  const eventIndex = parseInt(eventIndexPart, 10);

  return { ...toidComponents, eventIndex };
}
