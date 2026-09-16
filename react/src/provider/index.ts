"use client";
/**
 * Complete Colibri and TanStack Query provider setup.
 * @module
 */
// @deno-types="@types/react"
import { createElement, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ColibriProvider,
  type ColibriProviderProps,
} from "@/context/provider.ts";
import type { ReactElement } from "@/shared/types.ts";
/** Complete provider configuration with an optional application-owned cache. */
export interface ColibriQueryProviderProps extends ColibriProviderProps {
  /** Reuse an existing cache. Without one, each mounted provider owns its cache. */
  queryClient?: ColibriQueryClient;
}
/**
 * Provide Colibri and Query in one component. Never shares a singleton between
 * SSR requests. Caller-owned clients are never cleared. Owned caches are cleared
 * after unmount, preserving data during Strict Mode effect probing.
 * Mount one per application, or pass the existing application QueryClient.
 */
export function ColibriQueryProvider(
  { config, queryClient, children }: ColibriQueryProviderProps,
): ReactElement {
  const [owned] = useState(() => new QueryClient());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Strict Mode immediately sets up the same effect again. Dispose only
      // after that cycle, when the provider is still unmounted.
      queueMicrotask(() => {
        if (!mounted.current) owned.clear();
      });
    };
  }, [owned]);
  return createElement(
    QueryClientProvider,
    { client: queryClient ?? owned },
    createElement(ColibriProvider, { config }, children),
  );
}
import type * as Query from "@tanstack/react-query";
/** The application's unmodified TanStack QueryClient type. */
export type ColibriQueryClient = Query.QueryClient;
export type * from "@/context/config.ts";
export type { ColibriProviderProps } from "@/context/provider.ts";
export type { ReactNode } from "@/shared/types.ts";

export type {
  AuthEntrySigner,
  BaseMeta,
  ColibriError,
  ContractId,
  CustomNetworkConfig,
  Diagnostic,
  Ed25519PublicKey,
  EnvelopeSigner,
  ErrorDomain,
  ExtraSignerKey,
  FutureNetConfig,
  HorizonConfig,
  INetworkConfig,
  MainNetConfig,
  MessageSigner,
  NetworkConfig,
  NetworkPassphrase,
  NetworkType,
  PreAuthTransactionSigner,
  PreAuthTx,
  RPCConfig,
  Sha256Hash,
  SignedPayload,
  Signer,
  SignerKey,
  TestNetConfig,
  TransactionXDRBase64,
} from "@colibri/core";
