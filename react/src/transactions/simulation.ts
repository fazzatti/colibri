"use client";
import { useColibriConfig } from "@/provider.ts";
import { ColibriReactError, ReactCode } from "@/error.ts";
import {
  simulateTransaction,
  type SimulateTransactionInput,
  type SimulateTransactionOutput,
} from "@colibri/core/simulation";
import type { UseMutationResult } from "@/native.ts";
import { useRpc } from "@/rpc.ts";
import { useColibriMutation } from "@/mutation.ts";
import type { MutationControls } from "@/query.ts";
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
