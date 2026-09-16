"use client";
// @deno-types="@types/react"
import { useSyncExternalStore } from "react";

import { useQuery } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@/shared/types.ts";
import type {
  WebAuthAuthenticationOptions,
  WebAuthClient,
  WebAuthConstructionOptions,
  WebAuthToken,
} from "@colibri/webauth";
import type {
  SessionState,
  WebAuthSession,
} from "@/webauth/session/session.ts";
import { useColibriConfig } from "@/context/provider.ts";
import {
  colibriQueryOptions,
  type MutationControls,
  type QueryControls,
} from "@/query/options.ts";
import { useColibriMutation } from "@/query/mutation/hook.ts";
import { ReactInvalidConfigError } from "@/errors/index.ts";
/** Discover a SEP-10/45 client. Pass a distinct scope for custom fetchers or discovery policies. */
export function useWebAuthClient(
  domain: string | undefined,
  options: Omit<WebAuthConstructionOptions, "network"> = {},
  query: QueryControls<WebAuthClient> = {},
  scope = "default",
): UseQueryResult<WebAuthClient, Error> {
  const config = useColibriConfig();
  return useQuery(
    colibriQueryOptions(config, "webauth-discovery", {
      domain,
      scope,
      allowHttp: options.allowHttp,
      timeout: options.timeout,
      submissionFormat: options.submissionFormat,
    }, async () => {
      const { WebAuthClient } = await import("@colibri/webauth");
      return WebAuthClient.fromDomain(domain!, {
        ...options,
        network: config.network,
      });
    }, { ...query, enabled: !!domain && (query.enabled ?? true) }),
  );
}
/** Observe a shared, memory-only session. */
export function useSession(session: WebAuthSession): SessionState {
  const config = useColibriConfig();
  if (session.config !== config) {
    throw new ReactInvalidConfigError("Session belongs to another provider");
  }
  return useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
}
/** Authenticate on demand; successful credentials live only in the supplied session. */
export function useWebAuth(
  session: WebAuthSession,
  options: MutationControls<void, WebAuthAuthenticationOptions> = {},
): UseMutationResult<void, Error, WebAuthAuthenticationOptions> {
  useSession(session);
  // Return void so mutation-cache dehydration cannot copy the token.
  return useColibriMutation(async (args) => {
    await session.authenticate(args);
  }, options);
}
export {
  createWebAuthSession,
  WebAuthSession,
} from "@/webauth/session/session.ts";
export type { SessionState } from "@/webauth/session/session.ts";
export type { WebAuthAuthenticationOptions, WebAuthToken };
