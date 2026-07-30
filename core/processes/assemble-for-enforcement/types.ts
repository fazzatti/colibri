import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";

/** @internal */
export type AssembleForEnforcementInput = {
  transaction: Transaction;
  authorizedOperation: xdr.Operation;
  sorobanData?: SorobanDataBuilder;
  resourceFee: number;
};

/** @internal */
export type AssembleForEnforcementOutput = Transaction;
