"use client";
import type { ColibriConfig } from "@/context/config.ts";
import { ReactInvalidMethodError } from "@/errors/index.ts";
import type { UseMutationResult } from "@/shared/types.ts";
import { useColibriConfig } from "@/context/provider.ts";
import { useColibriMutation } from "@/query/mutation/hook.ts";
import { assertContractNetwork } from "@/contracts/network.ts";
import type {
  ContractIdentity,
  InvokeArgs,
  InvokeMethodName,
  InvokeResult,
} from "@/contracts/types.ts";
import type { MutationControls } from "@/query/options.ts";
/** Invoke a generated method through its existing pipeline, preserving plugins, explicit signers and decoded output. */
export function useContractInvoke<
  C extends ContractIdentity,
  M extends InvokeMethodName<C>,
>(
  contract: C,
  method: M,
  options: MutationControls<InvokeResult<C, M>, InvokeArgs<C, M>> = {},
): UseMutationResult<InvokeResult<C, M>, Error, InvokeArgs<C, M>> {
  const config = useColibriConfig();
  return useColibriMutation((args: InvokeArgs<C, M>) => {
    return invokeContractMethod(config, contract, method, args);
  }, options);
}
export type {
  InvokeArgs,
  InvokeMethodName,
  InvokeResult,
} from "@/contracts/types.ts";

/** @internal Invoke the original client without replacing its pipeline or plugins. */
export function invokeContractMethod<
  C extends ContractIdentity,
  M extends InvokeMethodName<C>,
>(
  config: ColibriConfig,
  contract: C,
  method: M,
  args: InvokeArgs<C, M>,
): Promise<InvokeResult<C, M>> {
  assertContractNetwork(config, contract);
  const member = contract[method] as {
    invoke: (args: InvokeArgs<C, M>) => Promise<InvokeResult<C, M>>;
  };
  if (!member || typeof member.invoke !== "function") {
    throw new ReactInvalidMethodError(
      `Contract has no invoke helper: ${method}`,
    );
  }
  return member.invoke(args);
}
