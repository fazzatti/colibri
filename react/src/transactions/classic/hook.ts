"use client";
// @deno-types="@types/react"
import { useMemo } from "react";

import {
  type ClassicTransactionInput,
  type ClassicTransactionOutput,
  type ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@colibri/core/classic-transaction";
import type { UseMutationResult } from "@/shared/types.ts";
import type { MutationControls } from "@/query/options.ts";
import { useColibriConfig } from "@/context/provider.ts";
import { useRpc } from "@/rpc/hooks.ts";
import { useColibriMutation } from "@/query/mutation.ts";
/** Execute the existing classic pipeline. Supply a stable pipeline to retain caller-installed plugins. */
export function useClassicTransaction(
  options:
    & MutationControls<ClassicTransactionOutput, ClassicTransactionInput>
    & { pipeline?: ClassicTransactionPipeline } = {},
): UseMutationResult<ClassicTransactionOutput, Error, ClassicTransactionInput> {
  const { network } = useColibriConfig();
  const rpc = useRpc();
  const pipeline = useMemo(
    () =>
      options.pipeline ??
        createClassicTransactionPipeline({ networkConfig: network, rpc }),
    [network, rpc, options.pipeline],
  );
  return useColibriMutation(
    (args: ClassicTransactionInput) => pipeline(args),
    options,
  );
}
