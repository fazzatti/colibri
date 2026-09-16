import type {
  QueryKey,
  UseMutationOptions,
  UseQueryOptions,
} from "@/shared/types.ts";
import type { ColibriConfig } from "@/context/config.ts";
import { ReactInvalidQueryValueError } from "@/errors/index.ts";
/** Query controls that cannot replace the feature's identity or executor. */
export type QueryControls<T> = Omit<
  UseQueryOptions<T, Error, T, QueryKey>,
  "queryKey" | "queryFn" | "queryKeyHashFn"
>;
/** Mutation controls. Automatic retries are always disabled for signing/submission. */
export type MutationControls<T, A> = Omit<
  UseMutationOptions<T, Error, A>,
  "mutationFn" | "retry" | "scope"
>;
/** Canonical JSON-safe cache representation; preserves bigint, bytes, map and XDR values. */
export function queryValue(
  value: unknown,
  seen: Set<object> = new Set<object>(),
): unknown {
  if (value === undefined) return ["undefined"];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ReactInvalidQueryValueError(
      "Cache inputs require finite numbers",
    );
  }
  if (
    value === null || typeof value === "string" || typeof value === "boolean" ||
    typeof value === "number"
  ) return [typeof value, value];
  if (typeof value !== "object" || seen.has(value)) {
    throw new ReactInvalidQueryValueError(
      "Cache inputs must be serializable and acyclic",
    );
  }
  return objectQueryValue(value, new Set(seen).add(value));
}
/** Serialize supported structured inputs after cycle detection. */
function objectQueryValue(value: object, next: Set<object>): unknown {
  if (value instanceof Uint8Array) return ["bytes", Array.from(value)];
  if ("toXDR" in value && typeof value.toXDR === "function") {
    return ["xdr", value.toXDR("base64")];
  }
  if ("toXdr" in value && typeof value.toXdr === "function") {
    return ["xdr", value.toXdr("base64")];
  }
  if (Array.isArray(value)) {
    return [
      "array",
      value.map((x) => queryValue(x, next)),
    ];
  }
  if (value instanceof Map) {
    return [
      "map",
      [...value].map(([k, v]) => [queryValue(k, next), queryValue(v, next)])
        .sort((a, b) =>
          JSON.stringify(a[0]).localeCompare(JSON.stringify(b[0]))
        ),
    ];
  }
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    throw new ReactInvalidQueryValueError(
      "Provide plain values, bytes, maps or XDR-serializable values in query keys",
    );
  }
  return [
    "object",
    Object.keys(value).sort().map(
      (k) => [k, queryValue((value as Record<string, unknown>)[k], next)],
    ),
  ];
}
/** Network and provider-scoped key, reusable for server prefetching and invalidation. */
export function colibriQueryKey(
  config: ColibriConfig,
  feature: string,
  input: unknown,
): QueryKey {
  return [
    "colibri",
    config.network.networkPassphrase,
    config.scope,
    feature,
    queryValue(input),
  ];
}
/** Build a feature query without importing React at runtime. */
export function colibriQueryOptions<T>(
  config: ColibriConfig,
  feature: string,
  input: unknown,
  queryFn: () => Promise<T>,
  query: QueryControls<T> = {},
): UseQueryOptions<T, Error, T, QueryKey> {
  return {
    staleTime: 10000,
    ...query,
    queryKey: colibriQueryKey(config, feature, input),
    queryFn,
  };
}
