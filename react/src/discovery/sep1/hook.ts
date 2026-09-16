"use client";
import { StellarToml, type StellarTomlOptions } from "@colibri/core/sep1";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@/shared/types.ts";
import { useColibriConfig } from "@/context/provider.ts";
import { colibriQueryOptions, type QueryControls } from "@/query/options.ts";
/** Fetch and validate SEP-1 discovery, including currency, anchor and WebAuth advertisements. Does not implement the advertised services. */
export function useStellarToml(
  domain: string | undefined,
  options: StellarTomlOptions = {},
  query: QueryControls<StellarToml> = {},
  scope = "default",
): UseQueryResult<StellarToml, Error> {
  const config = useColibriConfig();
  return useQuery(
    colibriQueryOptions(
      config,
      "sep1",
      {
        domain,
        scope,
        allowHttp: options.allowHttp,
        validate: options.validate,
        timeout: options.timeout,
      },
      () => StellarToml.fromDomain(domain!, options),
      {
        ...query,
        enabled: !!domain && (query.enabled ?? true),
      },
    ),
  );
}
