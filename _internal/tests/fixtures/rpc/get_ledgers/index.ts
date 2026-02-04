// deno-coverage-ignore-file

/**
 * @module tests/fixtures/rpc/get-ledgers
 * @description Fixture loader for RPC getLedgers responses
 * 
 * File naming convention: `xdr_lcm-v{version}_{sequence}.json`
 * Each file contains a single RawLedgerResponse matching the RPC format.
 * 
 * Supported versions (Lightsail archive normalizes TransactionMeta to v4):
 * - LedgerCloseMeta: v0, v1, v2
 * - TransactionMeta: v4 only
 * 
 * Envelope availability (all versions have envelopes from txSet):
 * - LedgerCloseMeta v0: ✅ Available from txSet.txes()
 * - LedgerCloseMeta v1/v2: ✅ Available from txSet.v1TxSet().phases()
 */

import type { rpc } from "stellar-sdk";

// Multi-version fixtures (separate files per LedgerCloseMeta version)
import lcmV0_30000000 from "./xdr_lcm-v0_30000000.json" with { type: "json" };
import lcmV1_55000000 from "./xdr_lcm-v1_55000000.json" with { type: "json" };
import lcmV2_60661500 from "./xdr_lcm-v2_60661500.json" with { type: "json" };
import lcmV2_60661501 from "./xdr_lcm-v2_60661501.json" with { type: "json" };

/**
 * Get a ledger fixture by sequence number.
 * 
 * @param sequence - Ledger sequence number
 * @returns Single ledger entry or undefined if not found
 */
export function getLedgerFixture(sequence: number): rpc.Api.RawLedgerResponse | undefined {
  const fixtures: Record<number, rpc.Api.RawLedgerResponse> = {
    30000000: lcmV0_30000000 as rpc.Api.RawLedgerResponse,
    55000000: lcmV1_55000000 as rpc.Api.RawLedgerResponse,
    60661500: lcmV2_60661500 as rpc.Api.RawLedgerResponse,
    60661501: lcmV2_60661501 as rpc.Api.RawLedgerResponse,
  };
  return fixtures[sequence];
}

/**
 * Load all available ledger fixtures.
 * 
 * @returns Array of all RawLedgerResponse fixtures
 */
export function loadLedgerFixtures(): rpc.Api.RawLedgerResponse[] {
  return [
    lcmV0_30000000 as rpc.Api.RawLedgerResponse,
    lcmV1_55000000 as rpc.Api.RawLedgerResponse,
    lcmV2_60661500 as rpc.Api.RawLedgerResponse,
    lcmV2_60661501 as rpc.Api.RawLedgerResponse,
  ];
}

/**
 * Load fixtures grouped by LedgerCloseMeta version.
 * 
 * @returns Object with fixtures keyed by LedgerCloseMeta version
 */
export function loadMultiVersionFixtures(): {
  lcm_v0: rpc.Api.RawLedgerResponse;
  lcm_v1: rpc.Api.RawLedgerResponse;
  lcm_v2: rpc.Api.RawLedgerResponse;
} {
  return {
    lcm_v0: lcmV0_30000000 as rpc.Api.RawLedgerResponse,
    lcm_v1: lcmV1_55000000 as rpc.Api.RawLedgerResponse,
    lcm_v2: lcmV2_60661500 as rpc.Api.RawLedgerResponse,
  };
}

/**
 * Load all v2 fixtures (for integration tests with envelope support).
 * 
 * @returns Array of v2 RawLedgerResponse fixtures
 */
export function loadV2Fixtures(): rpc.Api.RawLedgerResponse[] {
  return [
    lcmV2_60661500 as rpc.Api.RawLedgerResponse,
    lcmV2_60661501 as rpc.Api.RawLedgerResponse,
  ];
}
