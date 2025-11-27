/**
 *
 * CAP-0067: Introduced a variant in shape when muxed addresses are used.
 * Muxed addresses are now supported in mint and transfer events and will
 * use a map structure for the event value instead of a simple i128.
 */

import type { ScValParsed, ScValRecord } from "@/common/scval/types.ts";
import { isScValRecord } from "@/common/scval/index.ts";

/**
 * Type guard to check if value is a muxed event data structure.
 */
export function isEventMuxedData(value: ScValParsed): value is ScValRecord {
  if (!isScValRecord(value)) return false;
  return "amount" in value && typeof value.amount === "bigint";
}
