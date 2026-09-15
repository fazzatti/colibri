"use client";
// @deno-types="@types/react"
import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@/native.ts";
import {
  type AccountLedgerEntry,
  type BuildAccountLedgerKeyArgs,
  type BuildTrustlineLedgerKeyArgs,
  LedgerEntries,
  type TrustlineLedgerEntry,
} from "@colibri/core/ledger";
import { useRpc } from "@/rpc.ts";
import { useColibriConfig } from "@/provider.ts";
import { colibriQueryOptions, type QueryControls } from "@/query.ts";
/** Stable ledger reader for advanced known-key access. */
export function useLedgerEntries(): LedgerEntries {
  const rpc = useRpc();
  return useMemo(() => new LedgerEntries({ rpc }), [rpc]);
}
/** Read an existing Classic account, including balance, thresholds and signers. */
export function useAccount(
  accountId: BuildAccountLedgerKeyArgs["accountId"] | undefined,
  query: QueryControls<AccountLedgerEntry> = {},
): UseQueryResult<AccountLedgerEntry, Error> {
  const config = useColibriConfig();
  const reader = useLedgerEntries();
  return useQuery(
    colibriQueryOptions(
      config,
      "account",
      accountId,
      () => reader.account({ accountId: accountId! }),
      {
        ...query,
        enabled: !!accountId && (query.enabled ?? true),
      },
    ),
  );
}
/** Read a Classic trustline. Missing trustlines retain Core's structured error. */
export function useTrustline(
  args: BuildTrustlineLedgerKeyArgs | undefined,
  query: QueryControls<TrustlineLedgerEntry> = {},
): UseQueryResult<TrustlineLedgerEntry, Error> {
  const config = useColibriConfig();
  const reader = useLedgerEntries();
  return useQuery(
    colibriQueryOptions(
      config,
      "trustline",
      args
        ? {
          ...args,
          asset: "asset" in args ? args.asset?.toString() : undefined,
        }
        : undefined,
      () => reader.trustline(args!),
      { ...query, enabled: !!args && (query.enabled ?? true) },
    ),
  );
}
