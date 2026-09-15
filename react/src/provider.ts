"use client";
// @deno-types="@types/react"
import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
} from "react";
import type { ReactElement, ReactNode } from "@/native.ts";
import type { ColibriConfig, ConnectionState } from "@/config.ts";
import { ColibriReactError, ReactCode } from "@/error.ts";
import type { NetworkConfig } from "@colibri/core/network";
const Context = createContext<ColibriConfig | null>(null);
/** Provider props. The application owns config and QueryClient lifetimes. */
export interface ColibriProviderProps {
  /** Stable application configuration. */
  config: ColibriConfig;
  /** Descendant React content. */
  children?: ReactNode;
}
/** Provide a stable configuration; query hooks additionally need TanStack QueryClientProvider. */
export function ColibriProvider(
  { config, children }: ColibriProviderProps,
): ReactElement {
  return createElement(Context.Provider, { value: config }, children);
}
/** Read the current configuration. */
export function useColibriConfig(): ColibriConfig {
  const config = useContext(Context);
  if (!config) {
    throw new ColibriReactError(
      ReactCode.MISSING_PROVIDER,
      "Wrap this component in ColibriProvider",
    );
  }
  return config;
}
/** Observe connection state, with a deterministic disconnected SSR snapshot. */
export function useConnection(): ConnectionState {
  const config = useColibriConfig();
  return useSyncExternalStore(
    config.subscribe,
    config.getSnapshot,
    config.getServerSnapshot,
  );
}
/** Read the configured Stellar network; switching is explicit through a new provider configuration. */
export function useNetwork(): NetworkConfig {
  return useColibriConfig().network;
}
