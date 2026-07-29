import type {
  PostAuthEnforcedSimulationInput,
  PostAuthEnforcedSimulationOutput,
} from "@/processes/post-auth-enforced-simulation/types.ts";
import * as E from "@/processes/post-auth-enforced-simulation/error.ts";
import { SimulateTransactionError } from "@/processes/simulate-transaction/error.ts";
import { simulateTransaction } from "@/processes/simulate-transaction/index.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { getOperationsFromTransaction } from "@/common/helpers/transaction.ts";
import { hasDelegatedAuthorization } from "@/common/helpers/xdr/has-delegated-authorization.ts";

/**
 * Enforces completed delegated authorization entries through a second
 * simulation.
 *
 * When the assembled operation contains no delegated credentials, the process
 * returns the original recording simulation and performs no RPC request.
 */
export const postAuthEnforcedSimulation = async (
  input: PostAuthEnforcedSimulationInput,
): Promise<PostAuthEnforcedSimulationOutput> => {
  try {
    const { transaction, recordingSimulation, rpc } = input;

    assertRequiredArgs(
      { transaction },
      () => new E.MISSING_TRANSACTION(input),
    );
    assertRequiredArgs(
      { recordingSimulation },
      () => new E.MISSING_RECORDING_SIMULATION(input),
    );
    assertRequiredArgs(
      { rpc },
      () => new E.MISSING_RPC(input),
    );

    const requiresEnforcingSimulation = getOperationsFromTransaction(
      transaction,
    ).some(hasDelegatedAuthorization);

    if (!requiresEnforcingSimulation) return recordingSimulation;

    return await simulateTransaction({ transaction, rpc });
  } catch (error) {
    if (
      error instanceof E.PostAuthEnforcedSimulationError ||
      error instanceof SimulateTransactionError
    ) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(input, error as Error);
  }
};

/** Error constructors emitted by {@link postAuthEnforcedSimulation}. */
export const PostAuthEnforcedSimulationErrors: typeof E = E;
