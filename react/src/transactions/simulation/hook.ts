"use client";
import { useColibriConfig } from "@/context/provider.ts";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
import {
  simulateTransaction,
  type SimulateTransactionInput,
  type SimulateTransactionOutput,
} from "@colibri/core/simulation";
import type { UseMutationResult } from "@/shared/types.ts";
import { useRpc } from "@/rpc/hooks.ts";
import { useColibriMutation } from "@/query/mutation/hook.ts";
import type { MutationControls } from "@/query/options.ts";
/** Simulate a prepared Soroban transaction through Core; return auth, resources and restoration data without signing/submission. */
export function useSimulateSorobanTransaction(
  options: MutationControls<
    SimulateTransactionOutput,
    SimulateTransactionInput["transaction"]
  > = {},
): UseMutationResult<
  SimulateTransactionOutput,
  Error,
  SimulateTransactionInput["transaction"]
> {
  const rpc = useRpc();
  const { network } = useColibriConfig();
  return useColibriMutation(
    async (transaction) => {
      if (transaction.networkPassphrase !== network.networkPassphrase) {
        throw new ColibriReactError(
          ReactCode.NETWORK_MISMATCH,
          "Simulation and provider networks differ",
        );
      }
      return await simulateTransaction({ transaction, rpc });
    },
    options,
  );
}
