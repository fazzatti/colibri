import type {
  Keypair as StellarKeypair,
  Transaction as StellarTransaction,
  xdr,
} from "stellar-sdk";
import type { Server as StellarRpcServer } from "stellar-sdk/rpc";

/** @internal Exact Stellar SDK keypair type. */
export type Keypair = StellarKeypair;

/** @internal Exact Stellar SDK transaction type. */
export type Transaction = StellarTransaction;

/** @internal Exact Stellar SDK Soroban authorization-entry type. */
export type SorobanAuthorizationEntry = xdr.SorobanAuthorizationEntry;

/** @internal Exact Stellar SDK ledger-key type. */
export type LedgerKey = xdr.LedgerKey;

/** @internal Exact Stellar SDK ScVal type. */
export type ScVal = xdr.ScVal;

/** @internal Exact Stellar SDK RPC server type. */
export type Server = StellarRpcServer;
