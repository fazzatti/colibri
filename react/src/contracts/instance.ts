"use client";
// @deno-types="@types/react"
import { useMemo } from "react";
import type { DependencyList } from "@/native.ts";
import type { Contract } from "@colibri/core/contract";
/** Retain a full Contract or generated subclass, including owned pipelines/plugins. Change dependencies when its identity/configuration changes. */
export function useContract<T extends Contract>(
  factory: () => T,
  dependencies: DependencyList,
): T {
  return useMemo(factory, dependencies);
}
