import { ColibriError } from "@colibri/core";
import type { Diagnostic } from "@colibri/core";

/**
 * Error metadata carried by quickstart errors.
 */
export type Meta<DataType = unknown> = {
  cause: Error | null;
  data: DataType;
};

/**
 * Constructor shape shared by all quickstart errors.
 */
export type QuickstartErrorShape<CodeType extends string, DataType = unknown> = {
  code: CodeType;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: unknown;
  data: DataType;
};

/**
 * Error codes emitted by the Stellar quickstart test harness.
 */
export enum Code {
  INVALID_CONFIGURATION = "TTO_QKS_001",
  DOCKER_CONFIGURATION_ERROR = "TTO_QKS_002",
  CONTAINER_ERROR = "TTO_QKS_003",
  IMAGE_ERROR = "TTO_QKS_004",
  READINESS_ERROR = "TTO_QKS_005",
}

const normalizeCause = (cause?: unknown): Error | null => {
  if (cause === undefined || cause === null) {
    return null;
  }

  if (cause instanceof Error) {
    return cause;
  }

  if (typeof cause === "string") {
    return new Error(cause);
  }

  return new Error(JSON.stringify(cause));
};

/**
 * Base class for all quickstart-specific errors.
 */
export abstract class QuickstartError<
  CodeType extends string = Code,
  DataType = unknown,
> extends ColibriError<CodeType, Meta<DataType>> {
  override readonly source = "@colibri/test-tooling/quickstart";
  override readonly meta: Meta<DataType>;

  constructor(args: QuickstartErrorShape<CodeType, DataType>) {
    const meta: Meta<DataType> = {
      cause: normalizeCause(args.cause),
      data: args.data,
    };

    super({
      domain: "tools",
      source: "@colibri/test-tooling/quickstart",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Raised when a user-facing quickstart option is unsupported or malformed.
 */
export class INVALID_CONFIGURATION extends QuickstartError<
  Code.INVALID_CONFIGURATION,
  {
    option: string;
    value: unknown;
    supportedValues?: readonly unknown[];
  }
> {
  constructor(args: {
    option: string;
    value: unknown;
    message: string;
    details: string;
    supportedValues?: readonly unknown[];
    cause?: unknown;
  }) {
    super({
      code: Code.INVALID_CONFIGURATION,
      message: args.message,
      details: args.details,
      cause: args.cause,
      data: {
        option: args.option,
        value: args.value,
        supportedValues: args.supportedValues,
      },
    });
  }
}

/**
 * Raised when Docker connection settings are ambiguous or invalid.
 */
export class DOCKER_CONFIGURATION_ERROR extends QuickstartError<
  Code.DOCKER_CONFIGURATION_ERROR,
  Record<string, unknown>
> {
  constructor(args: {
    message: string;
    details: string;
    data?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super({
      code: Code.DOCKER_CONFIGURATION_ERROR,
      message: args.message,
      details: args.details,
      cause: args.cause,
      data: args.data || {},
    });
  }
}

/**
 * Raised when container lifecycle or inspection operations fail.
 */
export class CONTAINER_ERROR extends QuickstartError<
  Code.CONTAINER_ERROR,
  Record<string, unknown>
> {
  constructor(args: {
    message: string;
    details: string;
    data?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super({
      code: Code.CONTAINER_ERROR,
      message: args.message,
      details: args.details,
      cause: args.cause,
      data: args.data || {},
    });
  }
}

/**
 * Raised when the quickstart image cannot be pulled or streamed correctly.
 */
export class IMAGE_ERROR extends QuickstartError<
  Code.IMAGE_ERROR,
  Record<string, unknown>
> {
  constructor(args: {
    message: string;
    details: string;
    data?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super({
      code: Code.IMAGE_ERROR,
      message: args.message,
      details: args.details,
      cause: args.cause,
      data: args.data || {},
    });
  }
}

/**
 * Raised when the quickstart services never become ready for use.
 */
export class READINESS_ERROR extends QuickstartError<
  Code.READINESS_ERROR,
  Record<string, unknown>
> {
  constructor(args: {
    message: string;
    details: string;
    data?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super({
      code: Code.READINESS_ERROR,
      message: args.message,
      details: args.details,
      cause: args.cause,
      data: args.data || {},
    });
  }
}

/**
 * Registry of quickstart error constructors by code.
 */
export const ERROR_TTO_QKS = {
  [Code.INVALID_CONFIGURATION]: INVALID_CONFIGURATION,
  [Code.DOCKER_CONFIGURATION_ERROR]: DOCKER_CONFIGURATION_ERROR,
  [Code.CONTAINER_ERROR]: CONTAINER_ERROR,
  [Code.IMAGE_ERROR]: IMAGE_ERROR,
  [Code.READINESS_ERROR]: READINESS_ERROR,
};
