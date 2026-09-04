import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type EventErrorShape<CodeType extends string> = {
  code: CodeType;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

export abstract class EventError<
  CodeType extends string,
> extends ColibriError<CodeType, Meta> {
  override readonly source = "@colibri/core/event";
  override readonly meta: Meta;

  constructor(args: EventErrorShape<CodeType>) {
    const meta = {
      cause: args.cause ?? null,
      data: args.data,
    };

    super({
      domain: "core",
      source: "@colibri/core/event",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  INVALID_CONTRACT_ID = "EVT_001",
  INVALID_EVENT_ID = "EVT_002",
  UNKNOWN_EVENT_TYPE = "EVT_003",
  UNKNOWN_FIELD = "EVT_004",
  EVENT_SCHEMA_MISMATCH = "EVT_005",
  UNSUPPORTED_SCHEMA_FIELD_TYPE = "EVT_006",
  INVALID_EVENT_DATA_FORMAT = "EVT_007",
  INVALID_EVENT_ASSET_FORMAT = "EVT_008",
  TRANSFER_EXTENSION_DECODER_FAILED = "EVT_009",
  APPROVE_EXTENSION_DECODER_FAILED = "EVT_010",
  BURN_EXTENSION_DECODER_FAILED = "EVT_011",
  MINT_EXTENSION_DECODER_FAILED = "EVT_012",
  CLAWBACK_EXTENSION_DECODER_FAILED = "EVT_013",
}

export class INVALID_CONTRACT_ID extends EventError<Code> {
  constructor(contractId: string) {
    super({
      code: Code.INVALID_CONTRACT_ID,
      message:
        `Invalid event: contractId is not a valid ContractId (${contractId})`,
      details:
        "The event payload contains a contract id that is not a valid Stellar contract strkey.",
      data: { contractId },
    });
  }
}

export class INVALID_EVENT_ID extends EventError<Code> {
  constructor(eventId: string) {
    super({
      code: Code.INVALID_EVENT_ID,
      message: `Invalid event: id is not a valid EventId (${eventId})`,
      details:
        "The event payload id does not match Colibri's expected event id shape.",
      data: { eventId },
    });
  }
}

export class UNKNOWN_EVENT_TYPE extends EventError<Code> {
  constructor(eventType: string) {
    super({
      code: Code.UNKNOWN_EVENT_TYPE,
      message: `Unknown event type: ${eventType}`,
      details:
        "The event payload type is not one of the supported RPC event categories.",
      data: { eventType },
    });
  }
}

export class UNKNOWN_FIELD extends EventError<Code> {
  constructor(field: string) {
    super({
      code: Code.UNKNOWN_FIELD,
      message: `Unknown field: ${field}`,
      details:
        "The requested field does not exist on the event schema for this template.",
      data: { field },
    });
  }
}

export class EVENT_SCHEMA_MISMATCH extends EventError<Code> {
  constructor(schemaName: string, expectedTopicCount: number) {
    super({
      code: Code.EVENT_SCHEMA_MISMATCH,
      message:
        `Event does not match ${schemaName} schema. Expected ${expectedTopicCount} topics with name "${schemaName}".`,
      details:
        "The event topics or value do not match the schema expected by the template class.",
      data: { schemaName, expectedTopicCount },
    });
  }
}

export class UNSUPPORTED_SCHEMA_FIELD_TYPE extends EventError<Code> {
  constructor(fieldType: string) {
    super({
      code: Code.UNSUPPORTED_SCHEMA_FIELD_TYPE,
      message: `Cannot convert value to ScVal for type: ${fieldType}`,
      details:
        "The event schema references a field type that Colibri cannot convert into ScVal filter segments.",
      data: { fieldType },
    });
  }
}

export class INVALID_EVENT_DATA_FORMAT extends EventError<Code> {
  constructor(eventName: string) {
    super({
      code: Code.INVALID_EVENT_DATA_FORMAT,
      message: `Invalid ${eventName} event data format`,
      details:
        "The event payload value does not match the format expected by the event accessor.",
      data: { eventName },
    });
  }
}

export class INVALID_EVENT_ASSET_FORMAT extends EventError<Code> {
  constructor(asset: string) {
    super({
      code: Code.INVALID_EVENT_ASSET_FORMAT,
      message: `Invalid SEP-11 asset format: ${asset}`,
      details:
        "The event topic value is not a valid SEP-11 Stellar asset canonical string.",
      data: { asset },
    });
  }
}

abstract class SEP41_EXTENSION_DECODER_FAILED extends EventError<Code> {
  constructor(
    code: Code,
    eventName: string,
    extensionKeys: readonly string[],
    cause: Error,
  ) {
    super({
      code,
      message: `Failed to decode ${eventName} event extensions`,
      details:
        "The application-provided SEP-41 extension decoder rejected or failed to transform the event's non-standard map fields.",
      cause,
      data: { eventName, extensionKeys },
    });
  }
}

export class TRANSFER_EXTENSION_DECODER_FAILED
  extends SEP41_EXTENSION_DECODER_FAILED {
  constructor(extensionKeys: readonly string[], cause: Error) {
    super(
      Code.TRANSFER_EXTENSION_DECODER_FAILED,
      "transfer",
      extensionKeys,
      cause,
    );
  }
}

export class APPROVE_EXTENSION_DECODER_FAILED
  extends SEP41_EXTENSION_DECODER_FAILED {
  constructor(extensionKeys: readonly string[], cause: Error) {
    super(
      Code.APPROVE_EXTENSION_DECODER_FAILED,
      "approve",
      extensionKeys,
      cause,
    );
  }
}

export class BURN_EXTENSION_DECODER_FAILED
  extends SEP41_EXTENSION_DECODER_FAILED {
  constructor(extensionKeys: readonly string[], cause: Error) {
    super(Code.BURN_EXTENSION_DECODER_FAILED, "burn", extensionKeys, cause);
  }
}

export class MINT_EXTENSION_DECODER_FAILED
  extends SEP41_EXTENSION_DECODER_FAILED {
  constructor(extensionKeys: readonly string[], cause: Error) {
    super(Code.MINT_EXTENSION_DECODER_FAILED, "mint", extensionKeys, cause);
  }
}

export class CLAWBACK_EXTENSION_DECODER_FAILED
  extends SEP41_EXTENSION_DECODER_FAILED {
  constructor(extensionKeys: readonly string[], cause: Error) {
    super(
      Code.CLAWBACK_EXTENSION_DECODER_FAILED,
      "clawback",
      extensionKeys,
      cause,
    );
  }
}

export const ERROR_EVT = {
  [Code.INVALID_CONTRACT_ID]: INVALID_CONTRACT_ID,
  [Code.INVALID_EVENT_ID]: INVALID_EVENT_ID,
  [Code.UNKNOWN_EVENT_TYPE]: UNKNOWN_EVENT_TYPE,
  [Code.UNKNOWN_FIELD]: UNKNOWN_FIELD,
  [Code.EVENT_SCHEMA_MISMATCH]: EVENT_SCHEMA_MISMATCH,
  [Code.UNSUPPORTED_SCHEMA_FIELD_TYPE]: UNSUPPORTED_SCHEMA_FIELD_TYPE,
  [Code.INVALID_EVENT_DATA_FORMAT]: INVALID_EVENT_DATA_FORMAT,
  [Code.INVALID_EVENT_ASSET_FORMAT]: INVALID_EVENT_ASSET_FORMAT,
  [Code.TRANSFER_EXTENSION_DECODER_FAILED]: TRANSFER_EXTENSION_DECODER_FAILED,
  [Code.APPROVE_EXTENSION_DECODER_FAILED]: APPROVE_EXTENSION_DECODER_FAILED,
  [Code.BURN_EXTENSION_DECODER_FAILED]: BURN_EXTENSION_DECODER_FAILED,
  [Code.MINT_EXTENSION_DECODER_FAILED]: MINT_EXTENSION_DECODER_FAILED,
  [Code.CLAWBACK_EXTENSION_DECODER_FAILED]: CLAWBACK_EXTENSION_DECODER_FAILED,
};
