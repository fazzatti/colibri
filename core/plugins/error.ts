import { ColibriError, type Diagnostic } from "@colibri/core";

export type Meta<Data> = {
  cause: Error | null;
  data: Data;
};

export type PluginErrorShape<Code extends string, Data> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: Data;
};

export abstract class PluginError<
  Code extends string,
  Data
> extends ColibriError<Code, Meta<Data>> {
  override readonly meta: Meta<Data>;

  constructor(args: PluginErrorShape<Code, Data>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "plugins" as const,
      source: "@colibri/plugins/*",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}
