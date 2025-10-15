import type { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { TransactionSigner } from "../../signer/types.ts";

export type SignAuthEntriesInput = {
  auth: xdr.SorobanAuthorizationEntry[];
  signers: TransactionSigner[];
  rpc: Server;
  networkPassphrase: string;
  validity?: LedgerValidity; // optional validity to add to the signature, defaults to 120 ledgers(~10 min)
  removeUnsigned?: boolean; // optional flag to remove unsigned entries in the auth array, defaults to false
};

export type LedgerValidity =
  | {
      validForLedgers: number;
    }
  | {
      validForSeconds: number;
    }
  | { validUntilLedgerSeq: number };

export type SignAuthEntriesOutput = xdr.SorobanAuthorizationEntry[];
