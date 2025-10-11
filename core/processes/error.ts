import { ResultOrError } from "../common/deferred/result-or-error.ts";
import { ColibriError } from "../error/index.ts";
import type { Diagnostic } from "../error/types.ts";

export type Meta<InputType> = {
  cause: Error | null;
  data: {
    input: InputType;
  };
};

export type ProcessErrorShape<Code extends string, InputType> = {
  code: Code;
  message: string;
  input: InputType;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

export abstract class ProcessError<
  Code extends string,
  InputType
> extends ColibriError<Code, Meta<InputType>> {
  override readonly meta: Meta<InputType>;

  constructor(args: ProcessErrorShape<Code, InputType>) {
    const meta = {
      cause: args.cause || null,
      data: { input: args.input },
    };

    super({
      domain: "processes" as const,
      source: "@colibri/core/processes/*",
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
  static deferInput<I, P extends unknown[], E extends ProcessError<string, I>>(
    this: new (input: I, ...params: P) => E,
    ...params: P
  ): ResultOrError<never, I, E> {
    return ResultOrError.wrapError<I, E>(
      (input: I) => new this(input, ...params)
    );
  }
}
