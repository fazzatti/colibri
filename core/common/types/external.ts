import type {
  Asset,
  Contract,
  ExternalExecutableRef as StellarExternalExecutableRef,
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

/**
 * Canonical SDK 17 XDR value accepted by low-level Colibri APIs.
 * @internal
 */
export type XdrSerializable = xdr.XdrValue;

/**
 * Canonical Stellar ledger-key value.
 * @internal
 */
export type LedgerKeyLike = xdr.LedgerKey;

/**
 * Canonical Stellar asset accepted when deriving a trustline ledger key.
 * @internal
 */
export type TrustlineAssetLike = Asset;

/**
 * Canonical Stellar transaction envelopes accepted by signer helpers.
 * @internal
 */
export type SignableTransaction = Transaction | FeeBumpTransaction;

/**
 * Canonical Soroban authorization-entry value.
 * @internal
 */
export type SorobanAuthorizationEntryLike = xdr.SorobanAuthorizationEntry;

/**
 * Canonical Soroban contract value.
 * @internal
 */
export type ScValLike = xdr.ScVal;

/**
 * Canonical Stellar operation-result union used by classic outcome helpers.
 * @internal
 */
export type OperationResultTr = xdr.OperationResultTr;

/**
 * Canonical Stellar RPC event-filter payload.
 * @internal
 */
export type RpcEventFilterLike = Api.EventFilter;

/**
 * Canonical contract wrapper returned by Stellar RPC event payloads.
 * @internal
 */
export type ContractAddressLike = Contract;

/**
 * Canonical Stellar RPC event response.
 * @internal
 */
export type RpcEventResponseLike = Api.EventResponse;

/**
 * Canonical SDK 17 external executable reference.
 * @internal
 */
export type ExternalExecutableRef = StellarExternalExecutableRef;
