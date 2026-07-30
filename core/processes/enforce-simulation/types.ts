import type { Transaction } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";

/** @internal */
export type EnforceSimulationInput = {
  transaction: Transaction;
  recordingSimulation: SimulateTransactionOutput;
  rpc: Server;
};

/** @internal */
export type EnforceSimulationOutput = SimulateTransactionOutput;
