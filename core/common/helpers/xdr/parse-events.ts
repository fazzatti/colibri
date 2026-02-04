import { humanizeEvents, type xdr } from "stellar-sdk";

/**
 * Parses Soroban contract events into a human-readable format.
 *
 * @param events - Array of diagnostic or contract events to parse
 * @returns Humanized events or null if no events provided
 */
export const parseEvents = (
  events?: xdr.DiagnosticEvent[] | xdr.ContractEvent[]
): ReturnType<typeof humanizeEvents> | null => {
  return events ? humanizeEvents(events) : null;
};
