/**
 * SEP-41: Soroban Token Interface Events
 *
 * This module exports all SEP-41 token events as defined in:
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md
 *
 * @module
 */

import { MintEvent, MintEventSchema } from "@/event/standards/sep41/mint.ts";
import {
  TransferEvent,
  TransferEventSchema,
} from "@/event/standards/sep41/transfer.ts";
import {
  ApproveEvent,
  ApproveEventSchema,
} from "@/event/standards/sep41/approve.ts";
import { BurnEvent, BurnEventSchema } from "@/event/standards/sep41/burn.ts";
import {
  ClawbackEvent,
  ClawbackEventSchema,
} from "@/event/standards/sep41/clawback.ts";

/**
 * All SEP-41 events, schemas, and type guards.
 */
export const SEP41Events = {
  /** SEP-41 specification version implemented */
  VERSION: "0.4.0",
  // Events
  MintEvent,
  TransferEvent,
  ApproveEvent,
  BurnEvent,
  ClawbackEvent,
  // Schemas
  MintEventSchema,
  TransferEventSchema,
  ApproveEventSchema,
  BurnEventSchema,
  ClawbackEventSchema,
} as const;
