"use client";
// @deno-types="@types/react"
import { useMemo } from "react";

import type {
  AuthEntrySigner,
  EnvelopeSigner,
  PreAuthTransactionSigner,
  Signer,
} from "@colibri/core/signers";
import { useColibriConfig, useConnection } from "@/context/provider.ts";
import type { ColibriConfig, WalletConnection } from "@/context/config.ts";
import {
  ReactConnectionChangedError,
  ReactUnsupportedCapabilityError,
} from "@/errors/index.ts";
import { useColibriMutation } from "@/query/mutation/hook.ts";
import type { MutationControls } from "@/query/options.ts";
import type { UseMutationResult } from "@/shared/types.ts";
/** Reject a capability retained after the wallet identity or network changed. */
export function assertConnection(
  config: ColibriConfig,
  connection: WalletConnection | undefined,
): asserts connection is WalletConnection {
  if (!connection || config.getSnapshot().connection !== connection) {
    throw new ReactConnectionChangedError(
      "The wallet connection is no longer current",
    );
  }
}
/** Guard every signing boundary before and after an external wallet prompt. */
export function guardedSigners(
  config: ColibriConfig,
  connection: WalletConnection,
): readonly Signer[] {
  return connection.signers.map((signer) => {
    const guard = () => assertConnection(config, connection);
    const result = {
      signsFor: (target: Parameters<Signer["signsFor"]>[0]) => {
        guard();
        return signer.signsFor(target);
      },
    } as
      & Partial<
        & Omit<EnvelopeSigner, "signerKey">
        & AuthEntrySigner
        & Omit<PreAuthTransactionSigner, "signerKey">
      >
      & {
        signerKey?: () =>
          | ReturnType<EnvelopeSigner["signerKey"]>
          | ReturnType<PreAuthTransactionSigner["signerKey"]>;
      };
    if ("signerKey" in signer) {
      result.signerKey = () => {
        guard();
        return signer.signerKey();
      };
    }
    if ("signTransaction" in signer) {
      result.signTransaction = async (tx) => {
        guard();
        const value = await signer.signTransaction(tx);
        guard();
        return value;
      };
    }
    if ("signSorobanAuthEntry" in signer) {
      result.signSorobanAuthEntry = async (...args) => {
        guard();
        const value = await signer.signSorobanAuthEntry(...args);
        guard();
        return value;
      };
    }
    if ("authorizesTransaction" in signer) {
      result.authorizesTransaction = async (tx) => {
        guard();
        const value = await signer.authorizesTransaction(tx);
        guard();
        return value;
      };
    }
    return result as Signer;
  });
}
/** Current explicit signer capabilities, invalidated across account/network changes. */
export function useSigners(): readonly Signer[] {
  const config = useColibriConfig();
  const { connection } = useConnection();
  return useMemo(() => connection ? guardedSigners(config, connection) : [], [
    config,
    connection,
  ]);
}
/** Sign a SEP-53 message only when the connector explicitly supplies that capability. */
export function useSignMessage(
  options: MutationControls<Uint8Array, string | Uint8Array> = {},
): UseMutationResult<Uint8Array, Error, string | Uint8Array> {
  const config = useColibriConfig();
  const { connection } = useConnection();
  return useColibriMutation(async (message) => {
    assertConnection(config, connection);
    if (!connection.messageSigner) {
      throw new ReactUnsupportedCapabilityError(
        "This connection has no SEP-53 message signer",
      );
    }
    const value = await connection.messageSigner.signMessage(message);
    assertConnection(config, connection);
    return value;
  }, options);
}
