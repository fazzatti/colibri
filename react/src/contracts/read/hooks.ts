"use client";
import { specFingerprint } from "@/contracts/fingerprint.ts";
import { ReactInvalidMethodError } from "@/errors/index.ts";
import { skipToken, useQuery } from "@tanstack/react-query";
import type {
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from "@/shared/types.ts";
import {
  type ContractReadRequest,
  readContract,
} from "@colibri/core/contract-read";
import type { ColibriConfig } from "@/context/config.ts";
import { useColibriConfig } from "@/context/provider.ts";
import {
  colibriQueryKey,
  colibriQueryOptions,
  type QueryControls,
} from "@/query/options.ts";
import { contractIdentity } from "@/contracts/identity.ts";
import type {
  ContractIdentity,
  ReadArgs,
  ReadMethodName,
  ReadResult,
} from "@/contracts/types.ts";
/** Typed query arguments for a generated client's camelCase method property. */
export interface ContractReadOptions<
  C extends ContractIdentity,
  M extends ReadMethodName<C>,
> {
  /** Existing generated client and owned pipeline; undefined disables the query while loading. */
  contract: C | undefined;
  /** CamelCase generated helper property. */
  method: M;
  /** Arguments passed to the helper as a tuple. */
  args: ReadArgs<C, M>;
  /** Cache partition for different custom pipelines or plugins. */
  scope?: string;
  /** Optional cache and observation policy. */
  query?: QueryControls<ReadResult<C, M>>;
}
/** Query configuration usable for generated-client prefetching outside React. */
export function contractReadQueryOptions<
  C extends ContractIdentity,
  M extends ReadMethodName<C>,
>(
  config: ColibriConfig,
  options: ContractReadOptions<C, M>,
): UseQueryOptions<ReadResult<C, M>, Error, ReadResult<C, M>, QueryKey> {
  const { contract, method, args, query, scope } = options;
  if (!contract) {
    return {
      staleTime: 10000,
      ...query,
      queryKey: colibriQueryKey(config, "contract-read", {
        scope,
        method,
        args,
        pending: true,
      }),
      enabled: false,
      queryFn: skipToken,
    };
  }
  return colibriQueryOptions(config, "contract-read", {
    ...contractIdentity(config, contract),
    scope,
    method,
    args,
  }, () => {
    const member = contract[method] as {
      read: (...args: ReadArgs<C, M>) => Promise<ReadResult<C, M>>;
    };
    if (!member || typeof member.read !== "function") {
      throw new ReactInvalidMethodError(
        `Contract has no read helper: ${method}`,
      );
    }
    return member.read(...args);
  }, query);
}
/** Read through a generated client's existing pipeline with exact argument/result inference. */
export function useContractRead<
  C extends ContractIdentity,
  M extends ReadMethodName<C>,
>(options: ContractReadOptions<C, M>): UseQueryResult<ReadResult<C, M>, Error> {
  return useQuery(contractReadQueryOptions(useColibriConfig(), options));
}
/** Granular simulation query without a full Contract class; decoded type can be narrowed with a validator. */
export function useContractReadSpec<T = unknown>(
  request: Omit<ContractReadRequest, "networkConfig"> & { scope?: string },
  decode: (value: unknown) => T = ((value) => value as T),
  query: Omit<QueryControls<unknown>, "select"> = {},
): UseQueryResult<T, Error> {
  const config = useColibriConfig();
  return useQuery<unknown, Error, T>({
    ...colibriQueryOptions<unknown>(config, "contract-read-spec", {
      scope: request.scope,
      contractId: request.contractId,
      spec: specFingerprint(request.spec),
      method: request.method,
      methodArgs: request.methodArgs,
    }, () => readContract({ ...request, networkConfig: config.network })),
    ...query,
    select: decode,
  });
}
export type {
  ReadArgs,
  ReadMethodName,
  ReadResult,
} from "@/contracts/types.ts";
