"use client";
// @deno-types="@types/react"
import { useMemo } from "react";

import {
  type GetLatestLedgerResponse,
  type GetTransactionResponse,
  Server,
} from "@colibri/core/rpc";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@/shared/types.ts";
import { useColibriConfig } from "@/context/provider.ts";
import { colibriQueryOptions, type QueryControls } from "@/query/options.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
/** Memoized RPC client for the provider's endpoint. */
export function useRpc(): Server {
  const { network } = useColibriConfig();
  return useMemo(() => {
    if (!network.rpcUrl) {
      throw new ColibriReactError(
        ReactCode.INVALID_CONFIG,
        "Configure an RPC URL to use RPC hooks",
      );
    }
    return new Server(network.rpcUrl, {
      allowHttp: network.allowHttp ?? false,
    });
  }, [network.rpcUrl, network.allowHttp]);
}
/** Latest observed ledger; polling is opt-in through refetchInterval. */
export function useLatestLedger(
  query: QueryControls<GetLatestLedgerResponse> = {},
): UseQueryResult<GetLatestLedgerResponse, Error> {
  const config = useColibriConfig();
  const rpc = useRpc();
  return useQuery(
    colibriQueryOptions(
      config,
      "latest-ledger",
      null,
      () => rpc.getLatestLedger(),
      query,
    ),
  );
}
/** Read a transaction by hash. NOT_FOUND remains an observation, not a confirmed failure. */
export function useTransaction(
  hash: string | undefined,
  query: QueryControls<GetTransactionResponse> = {},
): UseQueryResult<GetTransactionResponse, Error> {
  const config = useColibriConfig();
  const rpc = useRpc();
  return useQuery(
    colibriQueryOptions(
      config,
      "transaction",
      hash,
      () => rpc.getTransaction(hash!),
      {
        ...query,
        enabled: !!hash && (query.enabled ?? true),
      },
    ),
  );
}
/** Poll an existing hash until RPC reports a terminal result. Does not submit or resubmit. */
export function useWaitForTransaction(
  hash: string | undefined,
  query: QueryControls<GetTransactionResponse> = {},
): UseQueryResult<GetTransactionResponse, Error> {
  return useTransaction(hash, {
    refetchInterval: (q) =>
      q.state.data && q.state.data.status !== "NOT_FOUND" ? false : 1000,
    ...query,
  });
}
