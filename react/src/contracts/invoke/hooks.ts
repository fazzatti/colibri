"use client";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
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
    assertContractNetwork(config, contract);
    const member = contract[method] as {
      invoke: (args: InvokeArgs<C, M>) => Promise<InvokeResult<C, M>>;
    };
    if (!member || typeof member.invoke !== "function") {
      throw new ColibriReactError(
        ReactCode.INVALID_METHOD,
        `Contract has no invoke helper: ${method}`,
      );
    }
    return member.invoke(args);
  }, options);
}
export type {
  InvokeArgs,
  InvokeMethodName,
  InvokeResult,
} from "@/contracts/types.ts";
