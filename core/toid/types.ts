/**
 * Represents Colibri's historical RPC-compatible TOID form.
 *
 * The value is a 64-bit signed integer serialized as a decimal string. It
 * encodes the ledger sequence, transaction application order, and operation
 * index minus one for one historical operation. Use Sep35OperationId for
 * standard packing without that historical offset.
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md#specification
 */
export type TOID = string & { __brand: "TOID" };

/** SEP-35 operation identifier with a one-based operation index in the low bits. */
export type Sep35OperationId = string & { __brand: "Sep35OperationId" };
