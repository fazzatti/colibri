import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/**
 * Metadata carried by plugin-layer Colibri errors.
 *
 * @typeParam Data - Plugin-specific structured payload.
 */
export type Meta<Data> = {
  /** Underlying failure when one exists. */
  cause: Error | null;
  /** Plugin-specific contextual data. */
  data: Data;
};

/**
 * Constructor arguments accepted by {@link PluginError}.
 *
 * @typeParam Code - Stable plugin error code.
 * @typeParam Data - Plugin-specific structured payload.
 */
export type PluginErrorShape<Code extends string, Data> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: Data;
};

/**
 * Base class for plugin-specific Colibri errors.
 *
 * @typeParam Code - Stable plugin error code.
 * @typeParam Data - Plugin-specific structured payload.
 */
export abstract class PluginError<
  Code extends string,
  Data
> extends ColibriError<Code, Meta<Data>> {
  /** Structured metadata associated with the plugin failure. */
  override readonly meta: Meta<Data>;

  /**
   * Creates a new plugin error instance.
   *
   * @param args - Error payload and metadata.
   */
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
