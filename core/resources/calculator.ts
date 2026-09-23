import type {
  CalculateResourcePaddingInput,
  ResourcePaddingCalculation,
} from "@/resources/types.ts";
import { applyResourceConfig } from "@/resources/policy.ts";
import {
  adjustmentAmount,
  ceilDiv,
  MAX_RESOURCE,
  requireKeys,
  requireMaximum,
  unsignedAmount,
} from "@/resources/arithmetic.ts";
import * as ERROR from "@/resources/error.ts";

const MAX_FEE_RATE = (1n << 63n) - 1n;

function meteredFee(units: bigint, rate: bigint, increment: bigint): bigint {
  // Match the canonical i64 saturating multiplication before division.
  const product = units * rate;
  return ceilDiv(product > MAX_FEE_RATE ? MAX_FEE_RATE : product, increment);
}

/**
 * Calculates concrete padding and its incremental resource fee, without I/O.
 *
 * Prices instruction/read/write growth using canonical per-increment rounding,
 * then adds the requested refundable allowance. Unchanged footprint, envelope,
 * and event costs cancel in the difference; future rent/workload is not predicted.
 * Recalculate if the simulation, network tariffs, footprint or envelope changes.
 * The pipeline never calls this utility automatically.
 *
 * @param input - Final simulation, same-network settings, and requested growth.
 * @returns Concrete padding, fee breakdown and the quote's source observations.
 * @throws {ResourceErrors.LIMIT_EXCEEDED} If adjusted declarations exceed supplied limits.
 * @throws {ResourceErrors.INVALID_CONFIGURATION} If values or adjustment modes are invalid.
 */
export function calculateResourcePadding(
  input: CalculateResourcePaddingInput,
): ResourcePaddingCalculation {
  const { simulation, settings, padding } = input;
  if (!simulation?.transactionData) throw new ERROR.MISSING_SIMULATION();
  requireKeys(padding, [
    "instructions",
    "diskReadBytes",
    "writeBytes",
    "refundableFee",
  ], "calculator.padding");
  const { refundableFee, ...resourcePadding } = padding;
  const original = simulation.transactionData.build();
  const adjusted = applyResourceConfig(original, { padding: resourcePadding });
  const dimensions = [
    ["instructions", "perInstructionIncrement", 10_000n],
    ["diskReadBytes", "perDiskRead1KB", 1_024n],
    ["writeBytes", "perWrite1KB", 1_024n],
  ] as const;
  let nonRefundableFee = 0n;
  let originalMeteredFee = 0n;
  for (const [field, rateField, increment] of dimensions) {
    const before = BigInt(original.resources[field]);
    const after = BigInt(adjusted.resources[field]);
    requireMaximum(
      after,
      unsignedAmount(settings.limits[field], `limits.${field}`),
      field,
    );
    const rate = unsignedAmount(
      settings.fees[rateField],
      `fees.${rateField}`,
      true,
    );
    requireMaximum(rate, MAX_FEE_RATE, `fees.${rateField}`);
    // Subtract rounded totals, not a rounded marginal quantity.
    const beforeFee = meteredFee(before, rate, increment);
    originalMeteredFee += beforeFee;
    nonRefundableFee += meteredFee(after, rate, increment) - beforeFee;
  }
  if (originalMeteredFee > original.resourceFee) {
    throw new ERROR.BELOW_RECOMMENDATION(
      "simulation.resourceFee",
      original.resourceFee,
      originalMeteredFee,
    );
  }
  const refundable = refundableFee === undefined ? 0n : adjustmentAmount(
    original.resourceFee,
    refundableFee,
    "refundableFee",
    true,
  );
  const fee = nonRefundableFee + refundable;
  requireMaximum(original.resourceFee + fee, MAX_RESOURCE, "resourceFee");
  return {
    padding: {
      instructions: {
        amount: adjusted.resources.instructions -
          original.resources.instructions,
      },
      diskReadBytes: {
        amount: adjusted.resources.diskReadBytes -
          original.resources.diskReadBytes,
      },
      writeBytes: {
        amount: adjusted.resources.writeBytes - original.resources.writeBytes,
      },
      resourceFee: { amount: fee.toString() },
    },
    breakdown: {
      nonRefundableFee: nonRefundableFee.toString(),
      refundableFee: refundable.toString(),
      resourceFee: fee.toString(),
    },
    simulationDataXdr: original.toXdr("base64"),
    simulationLedger: simulation.latestLedger,
    settingsLedger: settings.latestLedger,
    protocolVersion: settings.protocolVersion,
    networkPassphrase: settings.networkPassphrase,
  };
}
