import { Address, type xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import type { ContractId } from "@/strkeys/types.ts";
import { parseScVal } from "@/common/helpers/xdr/scval.ts";
import type { ScValParsed } from "@/common/helpers/xdr/types.ts";

/**
 * Function-call details decoded from a Soroban diagnostic event.
 *
 * Use this to identify the contract function that RPC reported as part of a
 * failed simulation. The first function-call diagnostic event is exposed as
 * the root invocation by {@link ParsedFailedSimulationResponse}.
 */
export type ParsedSimulationFunctionCall = {
  /** Contract being invoked by the diagnostic function call. */
  contractId: ContractId;
  /** Function name being invoked. */
  functionName: string;
};

/**
 * Contract-error topic decoded from a Soroban diagnostic event.
 *
 * Soroban contract errors are emitted as `Error(Contract, #code)` values. This
 * type carries the numeric contract-defined code without trying to map it to a
 * specific contract enum.
 */
export type ParsedSimulationDiagnosticContractError = {
  /** Soroban error family reported in the diagnostic event. */
  type: "sceContract";
  /** Contract-defined numeric error code. */
  code: number;
};

/**
 * Invocation level that emitted a parsed contract error.
 *
 * `root-invocation` means the error event came from the top-level contract call
 * that was simulated. `sub-invocation` means the error event came from a
 * contract called by that root invocation.
 */
export type ParsedSimulationErrorIssuer =
  | "root-invocation"
  | "sub-invocation";

/**
 * Common fields shared by parsed simulation diagnostic events.
 *
 * These fields preserve the RPC event order while converting topics and data
 * into TypeScript-friendly values with Colibri's XDR parsing helpers.
 */
export type ParsedSimulationDiagnosticEventBase = {
  /** Event index in `simulationResponse.events`. */
  index: number;
  /** Whether Soroban marks the event as emitted inside a successful call. */
  inSuccessfulContractCall: boolean;
  /** Contract that emitted the event, when the event carries one. */
  contractId?: ContractId;
  /** TypeScript-friendly diagnostic topics. */
  topics: ScValParsed[];
  /** TypeScript-friendly diagnostic data. */
  data: ScValParsed;
};

/**
 * Parsed diagnostic event for a Soroban function call.
 *
 * Function-call events are useful for understanding which contract and method
 * were being executed when later diagnostic errors were emitted.
 */
export type ParsedSimulationFunctionCallDiagnosticEvent =
  & ParsedSimulationDiagnosticEventBase
  & {
    /** Discriminator for TypeScript narrowing. */
    kind: "function-call";
    /** Parsed function-call details. */
    functionCall: ParsedSimulationFunctionCall;
  };

/**
 * Parsed diagnostic event for a Soroban contract error.
 *
 * This represents the diagnostic event itself. For a compact ordered list of
 * contract errors with root/sub-invocation classification, use
 * {@link ParsedSimulationContractErrorStackItem}.
 */
export type ParsedSimulationContractErrorDiagnosticEvent =
  & ParsedSimulationDiagnosticEventBase
  & {
    /** Discriminator for TypeScript narrowing. */
    kind: "contract-error";
    /** Parsed contract error details. */
    contractError: ParsedSimulationDiagnosticContractError;
  };

/**
 * Parsed diagnostic event that is neither a function call nor a contract error.
 *
 * Colibri keeps these events in the parsed list so consumers can inspect the
 * complete diagnostic sequence when troubleshooting simulation failures.
 */
export type ParsedSimulationOtherDiagnosticEvent =
  & ParsedSimulationDiagnosticEventBase
  & {
    /** Discriminator for TypeScript narrowing. */
    kind: "diagnostic";
  };

/**
 * Parsed diagnostic event from a failed Soroban simulation.
 *
 * The array returned by {@link parseFailedSimulationResponse} preserves the
 * order used by the RPC response so applications can inspect the full
 * diagnostic timeline.
 */
export type ParsedSimulationDiagnosticEvent =
  | ParsedSimulationFunctionCallDiagnosticEvent
  | ParsedSimulationContractErrorDiagnosticEvent
  | ParsedSimulationOtherDiagnosticEvent;

/**
 * Contract-error event extracted from parsed diagnostics.
 *
 * This is the shape most callers should use when they need to understand which
 * contract emitted an error code. It includes the emitting contract id and
 * whether the event came from the root invocation or a sub-invocation.
 */
export type ParsedSimulationContractErrorStackItem = {
  /** Contract-defined numeric error code. */
  code: number;
  /** Contract that emitted the error event. */
  contractId: ContractId;
  /** Index of the source event in `diagnosticEvents`. */
  eventIndex: number;
  /** Whether Soroban marks the event as emitted inside a successful call. */
  inSuccessfulContractCall: boolean;
  /** Whether the error was issued from the root invocation or a sub-invocation. */
  issuedFrom: ParsedSimulationErrorIssuer;
  /** TypeScript-friendly diagnostic data for the error event. */
  data: ScValParsed;
};

/**
 * Surface contract failure extracted from a failed Soroban simulation.
 *
 * This describes the contract error code that caused the simulation process to
 * fail. Use `matchingEventIndexes` to correlate the surfaced code with entries
 * in the ordered diagnostic event list.
 */
export type ParsedSimulationContractError = {
  /** Error family reported by Soroban. */
  kind: "contract";
  /** Contract-defined numeric error code. */
  code: number;
  /** Source used to extract the surfaced contract error. */
  source: "diagnostic-event" | "simulation-error-string";
  /** Diagnostic event indexes that carry this same contract error code. */
  matchingEventIndexes: number[];
};

/**
 * Parsed view of a failed Soroban simulation response.
 *
 * The parsed response keeps the root invocation, the surfaced contract error
 * when one is detected, the full diagnostic event sequence, and the compact
 * contract-error stack used by the matcher plugin.
 */
export type ParsedFailedSimulationResponse = {
  /** Root function call for the failed simulation, when it could be parsed. */
  rootInvocation?: ParsedSimulationFunctionCall;
  /** Surface contract error returned by RPC, when the failure is one. */
  contractError: ParsedSimulationContractError | null;
  /** Ordered diagnostic events with commonly needed fields decoded. */
  diagnosticEvents: ParsedSimulationDiagnosticEvent[];
  /** Ordered contract-error events extracted from `diagnosticEvents`. */
  contractErrorStack: ParsedSimulationContractErrorStackItem[];
};

/**
 * Parses a failed simulation response into typed diagnostic details.
 *
 * Use this when you catch a simulation failure and need to inspect the root
 * invocation, ordered diagnostic events, or contract-error stack. The parser is
 * defensive: malformed diagnostic events are skipped so callers still get the
 * usable parts of the response.
 *
 * @param response - Failed simulation response returned by RPC.
 * @returns A typed view of the surfaced contract error and ordered diagnostics.
 *
 * @example Parse the diagnostic stack from a failed simulation response.
 * ```ts
 * import { parseFailedSimulationResponse } from "@colibri/core";
 *
 * const parsed = parseFailedSimulationResponse(simulationResponse);
 * console.log(parsed.contractError?.code);
 * console.log(parsed.contractErrorStack);
 * ```
 */
export const parseFailedSimulationResponse = (
  response: Api.SimulateTransactionErrorResponse,
): ParsedFailedSimulationResponse => {
  const diagnosticEvents = parseDiagnosticEvents(response.events);
  const rootInvocation = diagnosticEvents.find(isFunctionCallDiagnosticEvent)
    ?.functionCall;
  const contractErrorStack = diagnosticEvents
    .filter(isContractErrorDiagnosticEvent)
    .flatMap((event) => {
      if (!event.contractId) return [];
      const issuedFrom = getErrorIssuer(
        event.contractId,
        rootInvocation,
      );
      if (!issuedFrom) return [];

      return [{
        code: event.contractError.code,
        contractId: event.contractId,
        eventIndex: event.index,
        inSuccessfulContractCall: event.inSuccessfulContractCall,
        issuedFrom,
        data: event.data,
      }];
    });

  const contractError = getContractErrorFromSimulationErrorString(
    response.error,
    contractErrorStack,
  ) ?? getContractErrorFromContractErrorStack(contractErrorStack);

  return {
    ...(rootInvocation === undefined ? {} : { rootInvocation }),
    contractError,
    diagnosticEvents,
    contractErrorStack,
  };
};

const isFunctionCallDiagnosticEvent = (
  event: ParsedSimulationDiagnosticEvent,
): event is ParsedSimulationFunctionCallDiagnosticEvent =>
  event.kind === "function-call";

const isContractErrorDiagnosticEvent = (
  event: ParsedSimulationDiagnosticEvent,
): event is ParsedSimulationContractErrorDiagnosticEvent =>
  event.kind === "contract-error";

const getErrorIssuer = (
  contractId: ContractId | undefined,
  rootInvocation: ParsedSimulationFunctionCall | undefined,
): ParsedSimulationErrorIssuer | undefined => {
  if (!contractId || !rootInvocation) return undefined;
  return contractId === rootInvocation.contractId
    ? "root-invocation"
    : "sub-invocation";
};

/**
 * Extracts the surfaced contract error from a failed simulation response.
 *
 * This is a lightweight helper for callers that only need to know whether RPC
 * surfaced `Error(Contract, #code)`. Use
 * {@link parseFailedSimulationResponse} when you also need diagnostic events or
 * the ordered contract-error stack.
 *
 * @param response - Failed simulation response returned by RPC.
 * @returns The parsed surfaced contract error, or `null` when the failure is
 * not a contract error or the response shape is not recognized.
 *
 * @example Read only the surfaced contract error code.
 * ```ts
 * import { getContractErrorFromFailedSimulationResponse } from "@colibri/core";
 *
 * const contractError =
 *   getContractErrorFromFailedSimulationResponse(simulationResponse);
 *
 * if (contractError) {
 *   console.log(contractError.code);
 * }
 * ```
 */
export const getContractErrorFromFailedSimulationResponse = (
  response: Api.SimulateTransactionErrorResponse,
): ParsedSimulationContractError | null =>
  parseFailedSimulationResponse(response).contractError;

const parseDiagnosticEvents = (
  events?: Api.SimulateTransactionErrorResponse["events"],
): ParsedSimulationDiagnosticEvent[] => {
  if (!events) return [];

  const diagnosticEvents: ParsedSimulationDiagnosticEvent[] = [];

  for (const [index, diagnosticEvent] of events.entries()) {
    try {
      const event = diagnosticEvent.event;
      const body = event.body.v0;
      const topics = body.topics;
      const parsedTopics = topics.map(parseScVal);
      const data = parseScVal(body.data);
      const contractError = getContractErrorFromTopics(topics);
      const functionCall = getFunctionCallFromTopics(topics);
      const baseEvent = {
        index,
        inSuccessfulContractCall: diagnosticEvent.inSuccessfulContractCall,
        contractId: getContractIdFromEvent(event),
        topics: parsedTopics,
        data,
      } satisfies ParsedSimulationDiagnosticEventBase;

      if (functionCall) {
        diagnosticEvents.push({
          ...baseEvent,
          kind: "function-call",
          functionCall,
        });
        continue;
      }

      if (contractError) {
        diagnosticEvents.push({
          ...baseEvent,
          kind: "contract-error",
          contractError,
        });
        continue;
      }

      diagnosticEvents.push({
        ...baseEvent,
        kind: "diagnostic",
      });
    } catch {
      continue;
    }
  }

  return diagnosticEvents;
};

const getContractErrorFromTopics = (
  topics: xdr.ScVal[],
): ParsedSimulationDiagnosticContractError | null => {
  for (const topic of topics) {
    const code = getContractErrorCodeFromScVal(topic);
    if (code !== null) {
      return {
        type: "sceContract",
        code,
      };
    }
  }

  return null;
};

const getFunctionCallFromTopics = (
  topics: xdr.ScVal[],
): ParsedSimulationFunctionCall | undefined => {
  try {
    if (topics.length < 3) return undefined;
    const kind = parseScVal(topics[0]);
    if (kind !== "fn_call") return undefined;

    const contractIdBytes = parseScVal(topics[1]);
    const functionName = parseScVal(topics[2]);
    if (!(contractIdBytes instanceof Uint8Array)) return undefined;
    if (typeof functionName !== "string") return undefined;

    return {
      contractId: Address.contract(contractIdBytes)
        .toString() as ContractId,
      functionName,
    };
  } catch {
    return undefined;
  }
};

const getContractErrorCodeFromScVal = (value: xdr.ScVal): number | null => {
  try {
    if (value.type !== "scvError") return null;

    const error = value.error;
    if (error.type !== "sceContract") return null;

    const code = error.contractCode;
    return Number.isFinite(code) ? code : null;
  } catch {
    return null;
  }
};

const getContractIdFromEvent = (
  event: xdr.ContractEvent,
): ContractId | undefined => {
  try {
    const contractIdBytes = event.contractId?.toBytes();
    return contractIdBytes
      ? Address.contract(contractIdBytes).toString() as ContractId
      : undefined;
  } catch {
    return undefined;
  }
};

const getContractErrorFromSimulationErrorString = (
  error?: string,
  contractErrorStack: ParsedSimulationContractErrorStackItem[] = [],
): ParsedSimulationContractError | null => {
  const code = error?.match(/Error\(Contract,\s*#(\d+)\)/)?.[1];
  if (!code) return null;
  const numericCode = Number(code);

  return {
    kind: "contract",
    code: numericCode,
    source: "simulation-error-string",
    matchingEventIndexes: contractErrorStack
      .filter((event) => event.code === numericCode)
      .map((event) => event.eventIndex),
  };
};

const getContractErrorFromContractErrorStack = (
  contractErrorStack: ParsedSimulationContractErrorStackItem[],
): ParsedSimulationContractError | null => {
  const lastContractError = contractErrorStack.at(-1);
  if (!lastContractError) return null;

  return {
    kind: "contract",
    code: lastContractError.code,
    source: "diagnostic-event",
    matchingEventIndexes: contractErrorStack
      .filter((event) => event.code === lastContractError.code)
      .map((event) => event.eventIndex),
  };
};
