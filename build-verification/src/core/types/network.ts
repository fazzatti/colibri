import type { INetworkConfig, RpcLedgerEntriesClient } from "@colibri/core";

/**
 * Exact Colibri network shape retained without re-exporting Core.
 * @internal
 */
export type BuildVerificationNetworkConfig = INetworkConfig;

/**
 * Exact Colibri RPC shape retained without re-exporting Core.
 * @internal
 */
export type BuildVerificationRpcClient = RpcLedgerEntriesClient;

/**
 * Mutually exclusive network inputs accepted for targets resolved through
 * Stellar RPC.
 */
export type VerificationNetwork =
  | {
    readonly networkConfig: BuildVerificationNetworkConfig;
    readonly rpc?: never;
    readonly rpcUrl?: never;
    readonly networkPassphrase?: never;
    readonly allowHttp?: never;
  }
  | {
    readonly rpc: BuildVerificationRpcClient;
    readonly networkPassphrase: string;
    readonly networkConfig?: never;
    readonly rpcUrl?: never;
    readonly allowHttp?: never;
  }
  | {
    readonly rpcUrl: string;
    readonly networkPassphrase: string;
    readonly allowHttp?: boolean;
    readonly networkConfig?: never;
    readonly rpc?: never;
  };

/** Redacted network facts retained in verification evidence. */
export type VerificationNetworkEvidence = {
  readonly networkPassphrase: string;
  readonly rpcUrl?: string;
  readonly allowHttp: boolean;
  readonly input: "networkConfig" | "rpc" | "rpcUrl";
};
