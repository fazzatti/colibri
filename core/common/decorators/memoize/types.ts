/**
 * @module memoize/types
 * @description Type definitions for the memoize decorator.
 */

/**
 * Options for configuring the memoize decorator behavior.
 *
 * @example
 * ```typescript
 * // Basic usage with TTL
 * @memoize({ ttl: 5000 })
 * get data(): Data { ... }
 *
 * // Disabled memoization (useful for testing)
 * @memoize({ enabled: false })
 * get value(): number { ... }
 *
 * // Custom key function for methods
 * @memoize({ keyFn: (obj) => obj.id })
 * fetchUser(user: { id: string }): Promise<User> { ... }
 * ```
 */
export interface MemoizeOptions {
  /**
   * Whether memoization is enabled.
   *
   * When `false`, the original getter/method is called every time,
   * bypassing the cache entirely. Useful for testing or debugging.
   *
   * @default true
   *
   * @example
   * ```typescript
   * // Disable caching for debugging
   * @memoize({ enabled: process.env.NODE_ENV !== 'test' })
   * get expensiveValue(): number { ... }
   * ```
   */
  enabled?: boolean;

  /**
   * Time-to-live in milliseconds.
   *
   * After this duration, the cached value expires and will be recomputed
   * on the next access. If not specified, cached values never expire.
   *
   * @default undefined (no expiry)
   *
   * @example
   * ```typescript
   * // Cache expires after 5 seconds
   * @memoize({ ttl: 5000 })
   * get freshData(): Data { ... }
   *
   * // TTL of 0 means always recompute (cache immediately expires)
   * @memoize({ ttl: 0 })
   * get alwaysFresh(): Data { ... }
   * ```
   */
  ttl?: number;

  /**
   * Custom function to generate cache keys for method arguments.
   *
   * By default, uses `JSON.stringify` on the arguments array.
   * Provide a custom function when:
   * - Arguments contain objects that should be keyed by specific properties
   * - You need more efficient key generation for performance
   * - Arguments contain values that don't serialize well with JSON
   *
   * @param args - The arguments passed to the method
   * @returns A string key for the cache lookup
   *
   * @default JSON.stringify
   *
   * @example
   * ```typescript
   * // Key by object ID instead of full serialization
   * @memoize({ keyFn: (user) => user.id })
   * fetchUserData(user: { id: string; name: string }): Promise<Data> { ... }
   *
   * // Combine multiple arguments into a key
   * @memoize({ keyFn: (a, b) => `${a}:${b}` })
   * compute(a: number, b: number): number { ... }
   * ```
   */
  keyFn?: (...args: unknown[]) => string;
}

/**
 * Context object provided by TC39 stage 3 decorators.
 *
 * This interface represents the metadata passed to decorator functions
 * by the JavaScript runtime, following the TC39 decorators proposal.
 *
 * @see https://github.com/tc39/proposal-decorators
 * @internal This type is used internally by the memoize decorator implementation.
 */
export type DecoratorContext = {
  /**
   * The kind of decorated element.
   *
   * - `"getter"` - A getter accessor
   * - `"setter"` - A setter accessor
   * - `"method"` - A class method
   * - `"field"` - A class field
   * - `"accessor"` - An auto-accessor field
   * - `"class"` - A class declaration
   */
  kind: "getter" | "method" | "field" | "class" | "accessor" | "setter";

  /**
   * The name of the decorated element.
   *
   * Can be a string for named members or a symbol for symbol-keyed members.
   */
  name: string | symbol;

  /**
   * Whether the decorated element is static.
   */
  static: boolean;

  /**
   * Whether the decorated element is private.
   */
  private: boolean;

  /**
   * Adds an initializer function to be called during class construction.
   *
   * @param initializer - Function to call during initialization
   */
  addInitializer: (initializer: () => void) => void;
};
