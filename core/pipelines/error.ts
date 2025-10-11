import { ColibriError } from "../error/index.ts";
import type { Diagnostic } from "../error/types.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type PipelineErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

export abstract class PipelineError<Code extends string> extends ColibriError<
  Code,
  Meta
> {
  override readonly meta: Meta;

  constructor(args: PipelineErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: {},
    };

    super({
      domain: "pipelines" as const,
      source: "@colibri/core/pipelines/*",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }

  // Returns a ResultOrError that can be unwrapped with the Input args.
  // useful when raising the error with args in a contained context and unwrapping
  // the error on an outer context or different input.
  // static deferInput<I, P extends unknown[], E extends PipelineError<string, I>>(
  //   this: new (input: I, ...params: P) => E,
  //   ...params: P
  // ): ResultOrError<never, I, E> {
  //   return ResultOrError.wrapError<I, E>(
  //     (input: I) => new this(input, ...params)
  //   );
  // }
}
