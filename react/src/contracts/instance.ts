"use client";
// @deno-types="@types/react"
import { useMemo } from "react";
import type { DependencyList } from "@/shared/types.ts";
import type { ContractIdentity } from "@/contracts/types.ts";
/** Retain a full Contract or generated subclass, including owned pipelines/plugins. Change dependencies when its identity/configuration changes. */
export function useContract<T extends ContractIdentity>(
  factory: () => T,
  dependencies: DependencyList,
): T {
  return useMemo(factory, dependencies);
}
