import type { Api } from "stellar-sdk/rpc";

export enum EventType {
  Contract = "contract",
  System = "system",
}

export type EventHandler = (event: Api.EventResponse) => Promise<void> | void;
