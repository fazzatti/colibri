"use client";
/**
 * Connection, lifecycle actions and guarded signing in one hook.
 * @module
 */
// @deno-types="@types/react"
import { useCallback } from "react";
import { useColibriConfig, useConnection } from "@/context/provider.ts";
import { useSigners } from "@/signers/hooks.ts";
import { ReactInvalidConfigError } from "@/errors/index.ts";
import type {
  ConnectionState,
  WalletConnection,
  WalletConnector,
} from "@/context/config.ts";
import type { Signer } from "@colibri/core/signers";
/** Wallet state and explicit user-triggered actions. */
export interface WalletState extends ConnectionState {
  /** Current address, absent while disconnected. */
  address?: string;
  /** Current guarded signing capabilities; invalidated when the connection changes. */
  signers: readonly Signer[];
  /** Wallet choices configured by the application. */
  connectors: readonly WalletConnector[];
  /** Connect explicitly; the id can be omitted when exactly one connector is configured. */
  connect(id?: string): Promise<WalletConnection | null>;
  /** Restore a chosen, already-authorized wallet without prompting. */
  reconnect(id?: string): Promise<WalletConnection | null>;
  /** Clear local authority and disconnect the wallet. */
  disconnect(): Promise<void>;
}
/** Common wallet flow without separately collecting connection, action and signer hooks. */
export function useWallet(): WalletState {
  const config = useColibriConfig();
  const state = useConnection();
  const signers = useSigners();
  const choose = useCallback((id?: string) => {
    if (id !== undefined) return id;
    if (config.connectors.length !== 1) {
      throw new ReactInvalidConfigError(
        "Choose a connector when zero or multiple wallets are configured",
      );
    }
    return config.connectors[0].id;
  }, [config]);
  const connect = useCallback(
    async (id?: string) => await config.connect(choose(id)),
    [
      config,
      choose,
    ],
  );
  const reconnect = useCallback(
    async (id?: string) => await config.connect(choose(id), true),
    [config, choose],
  );
  const disconnect = useCallback(() => config.disconnect(), [config]);
  return {
    ...state,
    address: state.connection?.address,
    signers,
    connectors: config.connectors,
    connect,
    reconnect,
    disconnect,
  };
}
export type {
  ConnectionState,
  WalletConnection,
  WalletConnector,
} from "@/context/config.ts";
export type {
  AuthEntrySigner,
  EnvelopeSigner,
  MessageSigner,
  PreAuthTransactionSigner,
  Signer,
} from "@colibri/core/signers";
export type {
  ContractId,
  Ed25519PublicKey,
  ExtraSignerKey,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
  SignerKey,
} from "@colibri/core/strkey";
export type { TransactionXDRBase64 } from "@colibri/core";
