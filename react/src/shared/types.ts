import type * as Query from "@tanstack/react-query";
// @deno-types="@types/react"
import type * as React from "react";
/** @internal Exact upstream query identity. */
export type QueryKey = Query.QueryKey;
/** @internal Exact upstream observer options. */
export type UseQueryOptions<
  T,
  E = Error,
  S = T,
  K extends QueryKey = QueryKey,
> = Query.UseQueryOptions<T, E, S, K>;
/** @internal Exact upstream observer result. */
export type UseQueryResult<T, E = Error> = Query.UseQueryResult<T, E>;
/** @internal Exact upstream mutation options. */
export type UseMutationOptions<T, E = Error, A = void> =
  Query.UseMutationOptions<T, E, A>;
/** @internal Exact upstream mutation result. */
export type UseMutationResult<T, E = Error, A = void> = Query.UseMutationResult<
  T,
  E,
  A
>;
/** @internal React child node. */
export type ReactNode = React.ReactNode;
/** @internal React element. */
export type ReactElement = React.ReactElement;
/** @internal React dependency list. */
export type DependencyList = React.DependencyList;
