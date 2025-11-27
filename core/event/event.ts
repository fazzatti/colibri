import type { Api } from "stellar-sdk/rpc";
import type { xdr } from "stellar-sdk";
import { parseScVal, parseScVals } from "@/common/scval/index.ts";
import type { ScValParsed } from "@/common/scval/types.ts";
import { isEventId, type EventId } from "@/event/event-id/index.ts";
import { EventType } from "@/event/types.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { isDefined } from "@/common/verifiers/is-defined.ts";
import { StrKey } from "@/strkeys/index.ts";

export class Event {
  id: EventId;
  type: EventType;
  ledger: number;
  ledgerClosedAt: string;
  transactionIndex: number;
  operationIndex: number;
  inSuccessfulContractCall: boolean;
  txHash: string;
  contractId: ContractId;
  scvalTopics: xdr.ScVal[];
  scvalValue: xdr.ScVal;

  constructor(args: Omit<Api.EventResponse, "type"> & { type: EventType }) {
    if (!isDefined(args.contractId)) {
      throw new Error(`Invalid event: missing contractId`);
    }

    const contractId = args.contractId.contractId();

    if (!StrKey.isValidContractId(contractId)) {
      throw new Error(
        `Invalid event: contractId is not a valid ContractId (${contractId})`
      );
    }

    if (!isEventId(args.id))
      throw new Error(`Invalid event: id is not a valid EventId (${args.id})`);

    this.id = args.id;
    this.type = args.type;
    this.ledger = args.ledger;
    this.ledgerClosedAt = args.ledgerClosedAt;
    this.transactionIndex = args.transactionIndex;
    this.operationIndex = args.operationIndex;
    this.inSuccessfulContractCall = args.inSuccessfulContractCall;
    this.txHash = args.txHash;
    this.contractId = contractId;
    this.scvalTopics = args.topic;
    this.scvalValue = args.value;
  }

  /**
   * Parsed topics as TypeScript-friendly values.
   * Computed on each access (not cached).
   */
  get topics(): ScValParsed[] {
    return parseScVals(this.scvalTopics);
  }

  /**
   * Parsed value as TypeScript-friendly value.
   * Computed on each access (not cached).
   */
  get value(): ScValParsed {
    return parseScVal(this.scvalValue);
  }

  /**
   * Factory to create Event from RPC EventResponse.
   */
  static fromEventResponse(response: Api.EventResponse): Event {
    let eventType: EventType;
    switch (response.type) {
      case "contract":
        eventType = EventType.Contract;
        break;
      case "system":
        eventType = EventType.System;
        break;
      default:
        throw new Error(`Unknown event type: ${response.type}`);
    }

    return new Event({
      ...response,
      type: eventType,
    });
  }
}
