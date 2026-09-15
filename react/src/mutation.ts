"use client";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationResult } from "@/native.ts";
import { useColibriConfig } from "@/provider.ts";
import type { MutationControls } from "@/query.ts";
/** Shared mutation policy: mutations never run during rendering and are never automatically retried. */
export function useColibriMutation<T, A>(
  execute: (args: A) => Promise<T>,
  options: MutationControls<T, A> = {},
): UseMutationResult<T, Error, A> {
  const config = useColibriConfig();
  return useMutation({
    ...options,
    mutationFn: execute,
    retry: false,
    scope: {
      id: `colibri:${config.network.networkPassphrase}:${config.scope}`,
    },
  });
}
