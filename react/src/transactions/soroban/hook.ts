"use client";
// @deno-types="@types/react"
import { useMemo } from "react";

import {
  createInvokeContractPipeline,
  type InvokeContractInput,
  type InvokeContractOutput,
  type InvokeContractPipeline,
} from "@colibri/core/soroban-transaction";
import type { UseMutationResult } from "@/shared/types.ts";
import type { MutationControls } from "@/query/options.ts";
import { useColibriConfig } from "@/context/provider.ts";
import { useRpc } from "@/rpc/hooks.ts";
import { useColibriMutation } from "@/query/mutation.ts";
/** Execute the existing soroban pipeline. Supply a stable pipeline to retain caller-installed plugins. */
export function useSorobanTransaction(
  options: MutationControls<InvokeContractOutput, InvokeContractInput> & {
    pipeline?: InvokeContractPipeline;
  } = {},
): UseMutationResult<InvokeContractOutput, Error, InvokeContractInput> {
  const { network } = useColibriConfig();
  const rpc = useRpc();
  const pipeline = useMemo(
    () =>
      options.pipeline ??
        createInvokeContractPipeline({ networkConfig: network, rpc }),
    [network, rpc, options.pipeline],
  );
  return useColibriMutation(
    (args: InvokeContractInput) => pipeline(args),
    options,
  );
}
