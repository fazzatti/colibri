import { ColibriError } from "@/error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export abstract class NetworkError<
  CodeType extends string,
> extends ColibriError<CodeType, Meta> {
  override readonly source = "@colibri/core/network";
  override readonly meta: Meta;

  constructor(args: {
    code: CodeType;
    message: string;
    details: string;
    data: unknown;
    cause?: Error;
  }) {
    const meta = {
      cause: args.cause ?? null,
      data: args.data,
    };

    super({
      domain: "core",
      source: "@colibri/core/network",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  PROPERTY_NOT_SET = "NET_001",
  PROPERTY_ALREADY_SET = "NET_002",
}

export class PROPERTY_NOT_SET extends NetworkError<Code> {
  constructor(property: string) {
    super({
      code: Code.PROPERTY_NOT_SET,
      message: `Property ${property} is not set in the Network Config instance`,
      details:
        "The requested NetworkConfig property was accessed before it was initialized.",
      data: { property },
    });
  }
}

export class PROPERTY_ALREADY_SET extends NetworkError<Code> {
  constructor(property: string) {
    super({
      code: Code.PROPERTY_ALREADY_SET,
      message:
        `Property ${property} is already set in the Network Config instance`,
      details:
        "The requested NetworkConfig property can only be set once for a given configuration instance.",
      data: { property },
    });
  }
}

export const ERROR_NET = {
  [Code.PROPERTY_NOT_SET]: PROPERTY_NOT_SET,
  [Code.PROPERTY_ALREADY_SET]: PROPERTY_ALREADY_SET,
};
