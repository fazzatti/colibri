/**
 * SAC (Stellar Asset Contract) Events
 *
 * This module exports all SAC token events as defined in:
 * - CAP-0046-06: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md
 * - CAP-0067: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md
 *
 * SAC events differ from SEP-41 events in that they include the
 * SEP-11 asset string (CODE:ISSUER) as an additional topic.
 *
 * Note: CAP-0067 removed the admin from mint, clawback, and set_authorized events.
 *
 * @module
 */

import {
  MintEvent,
  MintEventSchema,
  isMintMuxedData,
} from "@/event/standards/sac/mint.ts";
import type { MintMuxedData } from "@/event/standards/sac/mint.ts";
import {
  TransferEvent,
  TransferEventSchema,
  isTransferMuxedData,
} from "@/event/standards/sac/transfer.ts";
import type { TransferMuxedData } from "@/event/standards/sac/transfer.ts";
import {
  ApproveEvent,
  ApproveEventSchema,
} from "@/event/standards/sac/approve.ts";
import { BurnEvent, BurnEventSchema } from "@/event/standards/sac/burn.ts";
import {
  ClawbackEvent,
  ClawbackEventSchema,
} from "@/event/standards/sac/clawback.ts";
import {
  SetAdminEvent,
  SetAdminEventSchema,
} from "@/event/standards/sac/set_admin.ts";
import {
  SetAuthorizedEvent,
  SetAuthorizedEventSchema,
} from "@/event/standards/sac/set_authorized.ts";

/**
 * All SAC events, schemas, and type guards.
 */
export const SACEvents = {
  /** SAC specification version (Protocol 23+) */
  VERSION: "P23",
  // Events
  MintEvent,
  TransferEvent,
  ApproveEvent,
  BurnEvent,
  ClawbackEvent,
  SetAdminEvent,
  SetAuthorizedEvent,
  // Schemas
  MintEventSchema,
  TransferEventSchema,
  ApproveEventSchema,
  BurnEventSchema,
  ClawbackEventSchema,
  SetAdminEventSchema,
  SetAuthorizedEventSchema,
  // Type guards
  isMintMuxedData,
  isTransferMuxedData,
} as const;
