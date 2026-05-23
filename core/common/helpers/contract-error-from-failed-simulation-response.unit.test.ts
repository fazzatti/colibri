import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { Buffer } from "buffer";
import {
  getContractErrorFromFailedSimulationResponse,
  parseFailedSimulationResponse,
} from "@/common/helpers/contract-error-from-failed-simulation-response.ts";
import type { ContractId } from "@/strkeys/types.ts";

const ROOT_CONTRACT_BYTES = Uint8Array.from(Buffer.alloc(32, 1));
const SUB_CONTRACT_BYTES = Uint8Array.from(Buffer.alloc(32, 2));
const ROOT_CONTRACT_ID = Address.contract(Buffer.from(ROOT_CONTRACT_BYTES))
  .toString() as ContractId;
const SUB_CONTRACT_ID = Address.contract(Buffer.from(SUB_CONTRACT_BYTES))
  .toString() as ContractId;

const createResponse = (args: {
  error?: string;
  events?: xdr.DiagnosticEvent[];
}): Api.SimulateTransactionErrorResponse =>
  ({
    id: "mock-id",
    latestLedger: 1,
    _parsed: true,
    ...(args.error === undefined ? {} : { error: args.error }),
    ...(args.events === undefined ? {} : { events: args.events }),
  }) as Api.SimulateTransactionErrorResponse;

const createBytesScVal = (bytes: Uint8Array): xdr.ScVal =>
  xdr.ScVal.scvBytes(Buffer.from(bytes));

const createDiagnosticEvent = (args: {
  topics: xdr.ScVal[];
  data?: xdr.ScVal;
  contractIdBytes?: Uint8Array | null;
  inSuccessfulContractCall?: boolean;
}): xdr.DiagnosticEvent =>
  ({
    event: () => ({
      body: () => ({
        v0: () => ({
          topics: () => args.topics,
          data: () => args.data ?? xdr.ScVal.scvVoid(),
        }),
      }),
      contractId: () => args.contractIdBytes ?? null,
    }),
    inSuccessfulContractCall: () => args.inSuccessfulContractCall ?? false,
  }) as unknown as xdr.DiagnosticEvent;

const createMalformedDiagnosticEvent = (): xdr.DiagnosticEvent =>
  ({
    event: () => {
      throw new Error("malformed diagnostic event");
    },
    inSuccessfulContractCall: () => false,
  }) as unknown as xdr.DiagnosticEvent;

const createFunctionCallEvent = (args: {
  contractIdBytes: Uint8Array;
  functionName?: string;
}): xdr.DiagnosticEvent =>
  createDiagnosticEvent({
    contractIdBytes: args.contractIdBytes,
    topics: [
      xdr.ScVal.scvSymbol("fn_call"),
      createBytesScVal(args.contractIdBytes),
      xdr.ScVal.scvSymbol(args.functionName ?? "run"),
    ],
  });

const createContractErrorEvent = (args: {
  code: number;
  contractIdBytes?: Uint8Array | null;
  inSuccessfulContractCall?: boolean;
}): xdr.DiagnosticEvent =>
  createDiagnosticEvent({
    contractIdBytes: args.contractIdBytes,
    inSuccessfulContractCall: args.inSuccessfulContractCall,
    topics: [
      xdr.ScVal.scvSymbol("error"),
      xdr.ScVal.scvError(
        xdr.ScError.sceContract(args.code),
      ),
    ],
    data: xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("failing"),
      xdr.ScVal.scvU32(args.code),
    ]),
  });

describe("contract error parsing from failed simulation responses", () => {
  it("returns empty diagnostics and no contract error when the response has no events", () => {
    const result = parseFailedSimulationResponse(
      createResponse({ error: "HostError: Error(WasmVm, InvalidAction)" }),
    );

    assertEquals(result.rootInvocation, undefined);
    assertEquals(result.contractError, null);
    assertEquals(result.diagnosticEvents, []);
    assertEquals(result.contractErrorStack, []);
  });

  it("extracts a surfaced contract error through the convenience helper", () => {
    const error = getContractErrorFromFailedSimulationResponse(
      createResponse({
        error: "HostError: Error(Contract, #265)",
        events: [
          createFunctionCallEvent({ contractIdBytes: ROOT_CONTRACT_BYTES }),
          createContractErrorEvent({
            code: 265,
            contractIdBytes: ROOT_CONTRACT_BYTES,
          }),
        ],
      }),
    );

    assertEquals(error?.kind, "contract");
    assertEquals(error?.code, 265);
    assertEquals(error?.source, "simulation-error-string");
    assertEquals(error?.matchingEventIndexes, [1]);
  });

  it("falls back to the last diagnostic contract error when the error string has no contract code", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createFunctionCallEvent({ contractIdBytes: ROOT_CONTRACT_BYTES }),
          createContractErrorEvent({
            code: 1,
            contractIdBytes: ROOT_CONTRACT_BYTES,
          }),
          createContractErrorEvent({
            code: 265,
            contractIdBytes: SUB_CONTRACT_BYTES,
            inSuccessfulContractCall: true,
          }),
        ],
      }),
    );

    assertEquals(result.rootInvocation?.contractId, ROOT_CONTRACT_ID);
    assertEquals(result.contractError?.kind, "contract");
    assertEquals(result.contractError?.code, 265);
    assertEquals(result.contractError?.source, "diagnostic-event");
    assertEquals(result.contractError?.matchingEventIndexes, [2]);
    assertEquals(result.contractErrorStack.length, 2);
    assertEquals(result.contractErrorStack[0].contractId, ROOT_CONTRACT_ID);
    assertEquals(result.contractErrorStack[0].issuedFrom, "root-invocation");
    assertEquals(result.contractErrorStack[1].contractId, SUB_CONTRACT_ID);
    assertEquals(result.contractErrorStack[1].issuedFrom, "sub-invocation");
    assertEquals(result.contractErrorStack[1].inSuccessfulContractCall, true);
  });

  it("keeps a contract-error diagnostic without contract id out of the contract-error stack", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: Error(Contract, #1)",
        events: [
          createFunctionCallEvent({ contractIdBytes: ROOT_CONTRACT_BYTES }),
          createContractErrorEvent({
            code: 1,
            contractIdBytes: null,
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 2);
    assertEquals(result.diagnosticEvents[1].kind, "contract-error");
    assertEquals(result.diagnosticEvents[1].contractId, undefined);
    assertEquals(result.contractErrorStack, []);
    assertEquals(result.contractError?.code, 1);
    assertEquals(result.contractError?.matchingEventIndexes, []);
  });

  it("keeps a contract-error diagnostic without root invocation out of the contract-error stack", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createContractErrorEvent({
            code: 3477,
            contractIdBytes: ROOT_CONTRACT_BYTES,
          }),
        ],
      }),
    );

    assertEquals(result.rootInvocation, undefined);
    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "contract-error");
    assertEquals(result.diagnosticEvents[0].contractId, ROOT_CONTRACT_ID);
    assertEquals(result.contractErrorStack, []);
    assertEquals(result.contractError, null);
  });

  it("skips malformed diagnostic events and keeps parsing subsequent events", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createMalformedDiagnosticEvent(),
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [xdr.ScVal.scvSymbol("not_fn_call")],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.diagnosticEvents[0].index, 1);
    assertEquals(result.contractErrorStack, []);
  });

  it("treats non-function-call topics as a generic diagnostic event", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [
              xdr.ScVal.scvSymbol("not_fn_call"),
              createBytesScVal(ROOT_CONTRACT_BYTES),
              xdr.ScVal.scvSymbol("run"),
            ],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.diagnosticEvents[0].contractId, ROOT_CONTRACT_ID);
    assertEquals(result.contractError, null);
  });

  it("treats fn_call topics with a non-bytes contract id as a generic diagnostic event", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [
              xdr.ScVal.scvSymbol("fn_call"),
              xdr.ScVal.scvSymbol("not-bytes"),
              xdr.ScVal.scvSymbol("run"),
            ],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.contractError, null);
  });

  it("treats fn_call topics with a non-string function name as a generic diagnostic event", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [
              xdr.ScVal.scvSymbol("fn_call"),
              createBytesScVal(ROOT_CONTRACT_BYTES),
              createBytesScVal(Uint8Array.from([1])),
            ],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.contractError, null);
  });

  it("treats fn_call topics with an invalid contract id byte length as a generic diagnostic event", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [
              xdr.ScVal.scvSymbol("fn_call"),
              createBytesScVal(Uint8Array.from([1])),
              xdr.ScVal.scvSymbol("run"),
            ],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.contractError, null);
  });

  it("parses an event without contract id when the event contract id cannot be decoded", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: Uint8Array.from([1]),
            topics: [xdr.ScVal.scvSymbol("not_fn_call")],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.diagnosticEvents[0].contractId, undefined);
    assertEquals(result.contractError, null);
  });

  it("treats non-contract error topics as generic diagnostic events", () => {
    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: Error(WasmVm, InvalidAction)",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [
              xdr.ScVal.scvSymbol("error"),
              xdr.ScVal.scvError(
                xdr.ScError.sceWasmVm(
                  xdr.ScErrorCode.scecInvalidAction(),
                ),
              ),
            ],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.diagnosticEvents[0].contractId, ROOT_CONTRACT_ID);
    assertEquals(result.contractErrorStack, []);
    assertEquals(result.contractError, null);
  });

  it("treats contract error topics with non-finite codes as generic diagnostic events", () => {
    const nonFiniteContractErrorTopic = {
      switch: () => xdr.ScValType.scvError(),
      error: () => ({
        switch: () => ({ name: "sceContract" }),
        value: () => "not-a-number",
      }),
    } as unknown as xdr.ScVal;

    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [
              xdr.ScVal.scvSymbol("error"),
              nonFiniteContractErrorTopic,
            ],
          }),
        ],
      }),
    );

    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.diagnosticEvents[0].contractId, ROOT_CONTRACT_ID);
    assertEquals(result.contractErrorStack, []);
    assertEquals(result.contractError, null);
  });

  it("ignores a malformed contract-error topic after the topic is parsed", () => {
    let errorReadCount = 0;
    const unstableErrorTopic = {
      switch: () => xdr.ScValType.scvError(),
      error: () => {
        errorReadCount++;
        if (errorReadCount === 1) {
          return xdr.ScError.sceWasmVm(xdr.ScErrorCode.scecInvalidAction());
        }

        throw new Error("unstable error topic");
      },
    } as unknown as xdr.ScVal;

    const result = parseFailedSimulationResponse(
      createResponse({
        error: "HostError: diagnostic-only failure",
        events: [
          createDiagnosticEvent({
            contractIdBytes: ROOT_CONTRACT_BYTES,
            topics: [xdr.ScVal.scvSymbol("error"), unstableErrorTopic],
          }),
        ],
      }),
    );

    assert(errorReadCount > 1);
    assertEquals(result.diagnosticEvents.length, 1);
    assertEquals(result.diagnosticEvents[0].kind, "diagnostic");
    assertEquals(result.contractErrorStack, []);
    assertEquals(result.contractError, null);
  });
});
