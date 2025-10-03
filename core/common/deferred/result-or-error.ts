type DeferredFactory<UNWRAP_ARGS, ERROR> = (args: UNWRAP_ARGS) => ERROR;

export class ResultOrError<VALUE, UNWRAP_ARGS = never, ERROR = unknown> {
  private constructor(
    private readonly variant: "value" | "deferred",
    private readonly payload: VALUE | DeferredFactory<UNWRAP_ARGS, ERROR>
  ) {}

  static wrapVal<V, UA = never, E = unknown>(
    value: V
  ): ResultOrError<V, UA, E> {
    return new ResultOrError<V, UA, E>("value", value);
  }

  static wrapError<UA, E>(
    factory: DeferredFactory<UA, E>
  ): ResultOrError<never, UA, E> {
    return new ResultOrError<never, UA, E>("deferred", factory);
  }

  unwrap(args: UNWRAP_ARGS): VALUE {
    if (this.variant === "deferred")
      throw (this.payload as DeferredFactory<UNWRAP_ARGS, ERROR>)(args);
    return this.payload as VALUE;
  }
}
