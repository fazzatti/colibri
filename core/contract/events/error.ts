import { ColibriError } from "@/error/index.ts";

/** Stable failures for spec-aware contract events. */
export enum Code {
  INVALID_SPEC = "CEV_001",
  UNKNOWN_EVENT = "CEV_002",
  DECODE_FAILED = "CEV_003",
  INVALID_FILTER = "CEV_004",
  AMBIGUOUS_EVENT = "CEV_005",
}

/** Base error retaining event context and the original failure. */
export class ContractEventError
  extends ColibriError<Code, { cause?: unknown; data?: unknown }> {
  constructor(code: Code, message: string, data?: unknown, cause?: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/contract/events",
      code,
      message,
      details:
        "Check the loaded contract spec, emitting contract and encoded event fields.",
      meta: { data, cause },
    });
  }
}
/** The declarations cannot be represented without ambiguity or invalid fields. */
export class INVALID_SPEC extends ContractEventError {
  constructor(reason: string) {
    super(Code.INVALID_SPEC, `Invalid event spec: ${reason}`);
  }
}
/** No declaration exists at the requested name and occurrence. */
export class UNKNOWN_EVENT extends ContractEventError {
  constructor(name: string, occurrence: number) {
    super(Code.UNKNOWN_EVENT, `Unknown event: ${name} (${occurrence})`, {
      name,
      occurrence,
    });
  }
}
/** An occurrence does not conform to its selected declaration. */
export class DECODE_FAILED extends ContractEventError {
  constructor(name: string, cause?: unknown) {
    super(Code.DECODE_FAILED, `Event does not match ${name}`, { name }, cause);
  }
}
/** Filter arguments contain unknown or invalid indexed fields. */
export class INVALID_FILTER extends ContractEventError {
  constructor(name: string, cause?: unknown) {
    super(
      Code.INVALID_FILTER,
      `Invalid topic filter for ${name}`,
      { name },
      cause,
    );
  }
}
/** More than one declaration accepts the event. Select a definition explicitly. */
export class AMBIGUOUS_EVENT extends ContractEventError {
  constructor(names: string[]) {
    super(Code.AMBIGUOUS_EVENT, "Multiple event declarations match", { names });
  }
}
/** Stable constructors keyed by code. */
export const CONTRACT_EVENT_ERRORS = {
  ["CEV_001" as Code.INVALID_SPEC]: INVALID_SPEC,
  ["CEV_002" as Code.UNKNOWN_EVENT]: UNKNOWN_EVENT,
  ["CEV_003" as Code.DECODE_FAILED]: DECODE_FAILED,
  ["CEV_004" as Code.INVALID_FILTER]: INVALID_FILTER,
  ["CEV_005" as Code.AMBIGUOUS_EVENT]: AMBIGUOUS_EVENT,
};
