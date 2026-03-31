import type { xdr } from "stellar-sdk";
import { parseScVal, parseScVals } from "@/common/helpers/xdr/scval.ts";
import type { ScValParsed } from "@/common/helpers/xdr/types.ts";
import type {
  RpcEventResponseLike,
  ScValLike,
} from "@/common/types/index.ts";
import { isEventId, type EventId } from "@/event/event-id/index.ts";
import { EventType, type IEvent } from "@/event/types.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { isDefined } from "@/common/type-guards/is-defined.ts";
import { StrKey } from "@/strkeys/index.ts";

type EventConstructorArgs = Omit<RpcEventResponseLike, "type" | "contractId"> & {
  type: EventType;
  contractId?: ContractId;
};

/**
 * Normalized event wrapper for Stellar RPC event payloads.
 */
export class Event implements IEvent {
  /** Stable event identifier. */
  id: EventId;
  /** High-level event category. */
  type: EventType;
  /** Ledger sequence that emitted the event. */
  ledger: number;
  /** Ledger close timestamp as returned by RPC. */
  ledgerClosedAt: string;
  /** Index of the transaction within the ledger. */
  transactionIndex: number;
  /** Index of the operation within the transaction. */
  operationIndex: number;
  /** Whether the event came from a successful contract call. */
  inSuccessfulContractCall: boolean;
  /** Transaction hash associated with the event. */
  txHash: string;
  /** Optional contract id that emitted the event. */
  contractId?: ContractId | undefined;
  /** Raw topic segments emitted by the event. */
  scvalTopics: ScValLike[];
  /** Raw event payload emitted by the contract. */
  scvalValue: ScValLike;

  /**
   * Creates a normalized event wrapper.
   *
   * @param args Event payload fields.
   */
  constructor(
    args: EventConstructorArgs,
  ) {
    if (isDefined(args.contractId)) {
      const { contractId } = args;

      if (!StrKey.isContractId(contractId)) {
        throw new Error(
          `Invalid event: contractId is not a valid ContractId (${contractId})`
        );
      }

      this.contractId = contractId;
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
    this.scvalTopics = args.topic;
    this.scvalValue = args.value;
  }

  /**
   * Parsed topics as TypeScript-friendly values.
   * Computed on each access (not cached).
   */
  get topics(): ScValParsed[] {
    return parseScVals(this.scvalTopics as xdr.ScVal[]);
  }

  /**
   * Parsed value as TypeScript-friendly value.
   * Computed on each access (not cached).
   */
  get value(): ScValParsed {
    return parseScVal(this.scvalValue as xdr.ScVal);
  }

  /**
   * Factory to create Event from RPC EventResponse.
   */
  static fromEventResponse(response: RpcEventResponseLike): Event {
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

    let contractId: ContractId | undefined;

    if (isDefined(response.contractId)) {
      const eventContractId = response.contractId?.contractId();

      if (!StrKey.isContractId(eventContractId)) {
        throw new Error(
          `Invalid event: contractId is not a valid ContractId (${eventContractId})`
        );
      }

      contractId = eventContractId;
    }

    return new Event({
      ...response,
      type: eventType,
      contractId,
    });
  }
}
