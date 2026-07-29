import type { Transaction } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";

/** @internal */
export type PostAuthEnforcedSimulationInput = {
  transaction: Transaction;
  recordingSimulation: SimulateTransactionOutput;
  rpc: Server;
};

/** @internal */
export type PostAuthEnforcedSimulationOutput = SimulateTransactionOutput;
