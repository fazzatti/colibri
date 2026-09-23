import { SorobanDataBuilder, type xdr } from "stellar-sdk";
import type { TransactionResources } from "@/common/types/transaction-config/resources.ts";
import {
  adjustmentAmount,
  MAX_RESOURCE,
  requireKeys,
  requireMaximum,
  RESOURCE_FIELDS,
  type ResourceField,
  unsignedAmount,
} from "@/resources/arithmetic.ts";
import * as ERROR from "@/resources/error.ts";

export function resolveResourceValue(
  field: ResourceField,
  base: bigint,
  config: TransactionResources,
): bigint {
  if (base < 0n) {
    throw new ERROR.INVALID_CONFIGURATION(
      `simulation.${field}`,
      base.toString(),
    );
  }
  const override = config.override?.[field];
  const padding = config.padding?.[field];
  if (override !== undefined && padding !== undefined) {
    throw new ERROR.INVALID_CONFIGURATION(field, { override, padding });
  }
  let result = base;
  if (override !== undefined) {
    result = unsignedAmount(override, field, field === "resourceFee");
    if (result < base) {
      throw new ERROR.BELOW_RECOMMENDATION(field, result, base);
    }
  }
  if (padding !== undefined) {
    result += adjustmentAmount(base, padding, field, field === "resourceFee");
  }
  requireMaximum(result, MAX_RESOURCE, field);
  return result;
}

export function applyResourceConfig(
  data: xdr.SorobanTransactionData | undefined,
  config: TransactionResources,
): xdr.SorobanTransactionData {
  if (!data) throw new ERROR.MISSING_SIMULATION();
  requireKeys(config, ["override", "padding"], "resources");
  if (config.override !== undefined) {
    requireKeys(config.override, RESOURCE_FIELDS, "override");
  }
  if (config.padding !== undefined) {
    requireKeys(config.padding, RESOURCE_FIELDS, "padding");
  }
  const values = RESOURCE_FIELDS.map((field) =>
    resolveResourceValue(
      field,
      field === "resourceFee"
        ? data.resourceFee
        : BigInt(data.resources[field]),
      config,
    )
  );
  return new SorobanDataBuilder(data)
    .setResources(Number(values[0]), Number(values[1]), Number(values[2]))
    .setResourceFee(values[3]).build();
}
