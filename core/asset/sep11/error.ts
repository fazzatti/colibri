import { ColibriError } from "@/error/index.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export abstract class Sep11Error<
  CodeType extends string,
> extends ColibriError<CodeType, Meta> {
  override readonly source = "@colibri/core/asset/sep11";
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
      source: "@colibri/core/asset/sep11",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

export enum Code {
  MISSING_ISSUER_FOR_NON_NATIVE_ASSET = "AST_SEP11_001",
}

export class MISSING_ISSUER_FOR_NON_NATIVE_ASSET extends Sep11Error<Code> {
  constructor(code: string) {
    super({
      code: Code.MISSING_ISSUER_FOR_NON_NATIVE_ASSET,
      message: `Issuer required for non-native asset: ${code}`,
      details:
        "A non-native SEP-11 asset string requires an issuer account id.",
      data: { code },
    });
  }
}

export const ERROR_SEP11 = {
  [Code.MISSING_ISSUER_FOR_NON_NATIVE_ASSET]:
    MISSING_ISSUER_FOR_NON_NATIVE_ASSET,
};
