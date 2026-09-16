"use client";
// @deno-types="@types/react"
import { useCallback } from "react";

import { useColibriConfig } from "@/context/provider.ts";
import type { WalletConnection } from "@/context/config.ts";
/** Connect by identifier. Observe pending/error with the returned Promise and useConnection. */
export function useConnect(): (id: string) => Promise<WalletConnection | null> {
  const config = useColibriConfig();
  return useCallback((id: string) => config.connect(id), [config]);
}
/** Explicitly restore an already-authorized connection, without prompting. */
export function useReconnect(): (
  id: string,
) => Promise<WalletConnection | null> {
  const config = useColibriConfig();
  return useCallback((id: string) => config.connect(id, true), [config]);
}
/** Clear local connection state and ask the connector to disconnect. */
export function useDisconnect(): () => Promise<void> {
  const config = useColibriConfig();
  return useCallback(() => config.disconnect(), [config]);
}
