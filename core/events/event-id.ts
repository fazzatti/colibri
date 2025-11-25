import { regex } from "@/common/regex/index.ts";
import { isTOID, createTOID, parseTOID } from "@/toid/index.ts";
import type { TOID } from "@/toid/types.ts";

/**
 * Unique identifier for an event, based on the TOID format.
 * Format: 19-character zero-padded TOID + hyphen + 10-character zero-padded event index.
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
 * Creates an Event ID from a TOID and an event index.
 *
 * @param toid - The TOID for the operation that emitted this event
 * @param eventIndex - The index of the event within the operation (0-based, matches RPC)
 * @returns A formatted Event ID string
 *
 * @example
 * const eventId = createEventId("0000530242871959552" as TOID, 0);
 * // Returns: "0000530242871959552-0000000000"
 */
export function createEventId(toid: TOID, eventIndex: number): EventId {
  if (eventIndex < 1 || eventIndex > 9999999999) {
    throw new Error(
      `Event index out of range: ${eventIndex} (1-9,999,999,999)`
    );
  }

  // Shift to 0-based for output (matches RPC behavior)
  const eventIndex0 = eventIndex - 1;

  const toidPadded = toid.padStart(19, "0");
  const eventIndexPadded = eventIndex0.toString().padStart(10, "0");

  return `${toidPadded}-${eventIndexPadded}` as EventId;
}

/**
 * Creates an Event ID directly from ledger components.
 * Convenience function that combines createTOID and createEventId.
 *
 * @param ledgerSequence - The ledger sequence number
 * @param transactionOrder - The transaction application order (1-based)
 * @param operationIndex - The operation index (1-based)
 * @param eventIndex - The event index within the operation (0-based, matches RPC)
 * @returns A formatted Event ID string
 *
 * @example
 * const eventId = createEventIdFromParts(123456, 1, 1, 0);
 * // Returns: "0000530242871959552-0000000000"
 */
export function createEventIdFromParts(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number,
  eventIndex: number
): EventId {
  const toid = createTOID(ledgerSequence, transactionOrder, operationIndex);
  return createEventId(toid, eventIndex);
}

/**
 * Parses an Event ID back into its component parts.
 *
 * @param eventId - A valid Event ID string
 * @returns Object containing all components
 * @throws Error if the Event ID is invalid
 *
 * @example
 * const parts = parseEventId("0000530242871959553-0000000001");
 * // Returns: { ledgerSequence: 123456, transactionOrder: 1, operationIndex: 1, eventIndex: 1 }
 */
export function parseEventId(eventId: string): {
  ledgerSequence: number;
  transactionOrder: number;
  operationIndex: number;
  eventIndex: number;
} {
  if (!isEventId(eventId)) {
    throw new Error(`Invalid Event ID: ${eventId}`);
  }

  const [toidPart, eventIndexPart] = eventId.split("-");
  const toidComponents = parseTOID(toidPart);
  const eventIndex = parseInt(eventIndexPart, 10);

  return { ...toidComponents, eventIndex };
}
