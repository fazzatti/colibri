/**
 * Explicit Soroban resource policies, network settings and padding calculations.
 * @module
 */
import * as ERROR from "@/resources/error.ts";
export type * from "@/common/types/transaction-config/resources.ts";
export type * from "@/resources/types.ts";
export { calculateResourcePadding } from "@/resources/calculator.ts";
export { getNetworkResourceSettings } from "@/resources/settings.ts";
/** Typed errors for resource configuration, calculations and settings reads. */
export const ResourceErrors: typeof ERROR = ERROR;
