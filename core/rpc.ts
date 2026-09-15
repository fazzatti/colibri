/**
 * Native Stellar RPC client and response types, without loading Core workflows.
 * @module
 */
import { Server as NativeServer } from "stellar-sdk/rpc";
import type { Api as NativeApi } from "stellar-sdk/rpc";
/** @internal Exact native client. */
type NativeRpcInstance = NativeServer;
/** @internal Exact native constructor. */
type RpcConstructor = typeof NativeServer;
/** @internal Latest ledger response. */
type LatestResponse = NativeApi.GetLatestLedgerResponse;
/** @internal Transaction lookup response. */
type TransactionResponse = NativeApi.GetTransactionResponse;
/** Native Stellar RPC client, interchangeable with SDK clients. */
export type Server = NativeRpcInstance;
/** Native Stellar RPC constructor, without a wrapper. */
export const Server: RpcConstructor = NativeServer;
/** Latest ledger observed by the endpoint. */
export type GetLatestLedgerResponse = LatestResponse;
/** Transaction lookup outcome, including NOT_FOUND. */
export type GetTransactionResponse = TransactionResponse;
