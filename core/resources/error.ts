import { ColibriError } from "@/error/index.ts";

/** Stable resource-policy, calculator and network-settings errors. */
export enum Code {
  INVALID_CONFIGURATION = "RES_001",
  BELOW_RECOMMENDATION = "RES_002",
  LIMIT_EXCEEDED = "RES_003",
  MISSING_SIMULATION = "RES_004",
  UNSUPPORTED_TRANSACTION = "RES_005",
  SETTINGS_UNAVAILABLE = "RES_006",
}

/** Base error for explicit resource configuration and calculation. */
export abstract class ResourceError extends ColibriError<Code> {
  /** Records structured resource context and an optional underlying cause. */
  constructor(code: Code, message: string, data: unknown, cause?: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/resources",
      code,
      message,
      meta: { data, cause },
    });
  }
}

/** The resource policy is malformed, ambiguous, or contains an invalid value. */
export class INVALID_CONFIGURATION extends ResourceError {
  /** Identifies the invalid field and its value. */
  constructor(field: string, value: unknown) {
    super(
      Code.INVALID_CONFIGURATION,
      `Invalid resource configuration: ${field}.`,
      { field, value },
    );
  }
}

/** An absolute override is smaller than the final simulation recommendation. */
export class BELOW_RECOMMENDATION extends ResourceError {
  /** Records decimal values without confusing the recommendation with measured usage. */
  constructor(resource: string, configured: bigint, recommended: bigint) {
    super(
      Code.BELOW_RECOMMENDATION,
      `${resource} override is below the simulation recommendation.`,
      {
        resource,
        configured: configured.toString(),
        recommended: recommended.toString(),
      },
    );
  }
}

/** A resource value exceeds its representation or supplied network limit. */
export class LIMIT_EXCEEDED extends ResourceError {
  /** Records the resource, requested value and applicable maximum. */
  constructor(resource: string, requested: bigint, maximum: bigint) {
    super(Code.LIMIT_EXCEEDED, `${resource} exceeds its resource limit.`, {
      resource,
      requested: requested.toString(),
      maximum: maximum.toString(),
    });
  }
}

/** Resource configuration requires successful simulation data. */
export class MISSING_SIMULATION extends ResourceError {
  /** Explains the missing simulation prerequisite. */
  constructor() {
    super(
      Code.MISSING_SIMULATION,
      "Provide successful final simulation data before adjusting resources.",
      {},
    );
  }
}

/** A Classic transaction cannot consume Soroban resource configuration. */
export class UNSUPPORTED_TRANSACTION extends ResourceError {
  /** Explains the unsupported transaction configuration. */
  constructor() {
    super(
      Code.UNSUPPORTED_TRANSACTION,
      "Resource configuration requires a Soroban invocation.",
      {},
    );
  }
}

/** Required resource settings could not be read or are not supported. */
export class SETTINGS_UNAVAILABLE extends ResourceError {
  /** Records the setting or request that failed and retains its cause. */
  constructor(setting: string, cause?: unknown) {
    super(
      Code.SETTINGS_UNAVAILABLE,
      `Resource settings unavailable: ${setting}.`,
      { setting },
      cause,
    );
  }
}

/** Resource error constructors indexed by their stable codes. */
export const ERROR_RES = {
  ["RES_001" as Code.INVALID_CONFIGURATION]: INVALID_CONFIGURATION,
  ["RES_002" as Code.BELOW_RECOMMENDATION]: BELOW_RECOMMENDATION,
  ["RES_003" as Code.LIMIT_EXCEEDED]: LIMIT_EXCEEDED,
  ["RES_004" as Code.MISSING_SIMULATION]: MISSING_SIMULATION,
  ["RES_005" as Code.UNSUPPORTED_TRANSACTION]: UNSUPPORTED_TRANSACTION,
  ["RES_006" as Code.SETTINGS_UNAVAILABLE]: SETTINGS_UNAVAILABLE,
};
