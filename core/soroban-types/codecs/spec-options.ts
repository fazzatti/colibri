/** Controls decoding of named struct fields; tuple and union rules stay exact. */
export interface SorobanSpecOptions {
  /**
   * `evolution` (default) ignores unknown fields and decodes missing fields as
   * void only when the declared type accepts it. `strict` requires the exact
   * field set. Neither policy coerces wire types or changes dense encoding.
   */
  readonly structFields?: "evolution" | "strict";
}
