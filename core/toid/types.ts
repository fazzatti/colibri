/**
 * Represents a Stellar Operation ID (TOID) as defined in SEP-0035.
 * A TOID is a 64-bit signed integer that encodes the ledger sequence,
 * transaction application order, and operation index.
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 */
export type TOID = string & { __brand: "TOID" };
