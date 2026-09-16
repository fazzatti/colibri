"use client";
import type { TransactionConfig } from "@colibri/core";
import { useColibriConfig, useConnection } from "@/context/provider.ts";
import { useColibriMutation } from "@/query/mutation/hook.ts";
import { walletTransactionConfig } from "@/wallet/transaction-config.ts";
import { invokeContractMethod } from "@/contracts/invoke/hooks.ts";
import type {
  ContractIdentity,
  InvokeArgs,
  InvokeMethodName,
  InvokeResult,
} from "@/contracts/types.ts";
import type { MutationControls } from "@/query/options.ts";
import type { UseMutationResult } from "@/shared/types.ts";
/** Generated method arguments with optional wallet-derived transaction authority. */
export type WalletInvokeArgs<C, M extends keyof C> =
  & Omit<InvokeArgs<C, M>, "config">
  & {
    /** Explicit fields override wallet defaults; fees/timeouts retain the client's own defaults. */
    config?: Partial<TransactionConfig>;
  };
/**
 * Invoke through the existing generated client using the connected wallet by default.
 * No connection or signature prompt occurs until mutate/mutateAsync is called.
 * Source and signers can be overridden independently; explicit signers are never appended to.
 */
export function useWalletContractInvoke<
  C extends ContractIdentity,
  M extends InvokeMethodName<C>,
>(
  contract: C,
  method: M,
  options: MutationControls<InvokeResult<C, M>, WalletInvokeArgs<C, M>> = {},
): UseMutationResult<InvokeResult<C, M>, Error, WalletInvokeArgs<C, M>> {
  const config = useColibriConfig();
  const { connection } = useConnection();
  return useColibriMutation(async (args: WalletInvokeArgs<C, M>) => {
    return invokeContractMethod(config, contract, method, {
      ...args,
      config: await walletTransactionConfig(config, connection, args.config),
    } as InvokeArgs<C, M>);
  }, options);
}
