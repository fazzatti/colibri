/**
 * Represents Colibri's branded string form of a SEP-0035 operation ID.
 *
 * The value is a 64-bit signed integer serialized as a decimal string. It
 * encodes the ledger sequence, transaction application order, and operation
 * index for one historical operation.
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 */
export type TOID = string & { __brand: "TOID" };
