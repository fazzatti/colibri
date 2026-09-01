import type {
  Asset,
  Contract,
  FeeBumpTransaction,
  Transaction,
  xdr,
} from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";

/**
 * Binary payload accepted by Colibri's public byte-oriented APIs.
 *
 * The boundary intentionally accepts standard JavaScript byte containers
 * without exposing Node's `Buffer` as part of Colibri's public API.
 */
export type BinaryData = ArrayBuffer | ArrayBufferView;

/** Canonical SDK 17 XDR value accepted by low-level Colibri APIs. */
export type XdrSerializable = xdr.XdrValue;

/** Canonical Stellar ledger-key value. */
export type LedgerKeyLike = xdr.LedgerKey;

/** Canonical Stellar asset accepted when deriving a trustline ledger key. */
export type TrustlineAssetLike = Asset;

/** Canonical Stellar transaction envelopes accepted by signer helpers. */
export type SignableTransaction = Transaction | FeeBumpTransaction;

/** Canonical Soroban authorization-entry value. */
export type SorobanAuthorizationEntryLike = xdr.SorobanAuthorizationEntry;

/** Canonical Soroban contract value. */
export type ScValLike = xdr.ScVal;

/** Canonical Stellar RPC event-filter payload. */
export type RpcEventFilterLike = Api.EventFilter;

/** Canonical contract wrapper returned by Stellar RPC event payloads. */
export type ContractAddressLike = Contract;

/** Canonical Stellar RPC event response. */
export type RpcEventResponseLike = Api.EventResponse;
