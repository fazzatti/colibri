"use client";
import { ColibriReactError, ReactCode } from "@/errors/index.ts";
import { useQuery } from "@tanstack/react-query";
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
import { colibriQueryOptions, type QueryControls } from "@/query/options.ts";
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
  /** Existing generated client, with its owned read pipeline. */
  contract: C;
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
      throw new ColibriReactError(
        ReactCode.INVALID_METHOD,
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
      spec: request.spec.entries.map((e) => e.toXdr("base64")),
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
