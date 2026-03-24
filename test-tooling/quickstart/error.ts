export type Diagnostic = {
  rootCause: string;
  suggestion: string;
  materials?: string[];
};

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
export type QuickstartErrorShape<CodeType extends string, DataType = unknown> =
  {
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

  try {
    return new Error(JSON.stringify(cause));
  } catch {
    return new Error(String(cause));
  }
};

const serializeCause = (
  cause: Error | null,
): { name: string; message: string; stack?: string } | null => {
  if (!cause) {
    return null;
  }

  return {
    name: cause.name,
    message: cause.message,
    stack: cause.stack,
  };
};

/**
 * Base class for all quickstart-specific errors.
 */
export abstract class QuickstartError<
  CodeType extends string = Code,
  DataType = unknown,
> extends Error {
  readonly domain = "tools";
  readonly code: CodeType;
  readonly source = "@colibri/test-tooling/quickstart";
  readonly details: string;
  readonly diagnostic?: Diagnostic;
  readonly meta: Meta<DataType>;

  constructor(args: QuickstartErrorShape<CodeType, DataType>) {
    const meta: Meta<DataType> = {
      cause: normalizeCause(args.cause),
      data: args.data,
    };

    super(args.message);
    this.name = `QuickstartError ${args.code}`;
    this.code = args.code;
    this.details = args.details;
    this.diagnostic = args.diagnostic;
    this.meta = meta;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      domain: this.domain,
      code: this.code,
      message: this.message,
      source: this.source,
      details: this.details,
      diagnostic: this.diagnostic,
      meta: {
        ...this.meta,
        cause: serializeCause(this.meta.cause),
      },
    };
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
