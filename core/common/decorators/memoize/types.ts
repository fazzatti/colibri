/**
 * @module memoize/types
 * @description Type definitions for the memoize decorator.
 */

/**
 * Base options shared by all memoize configurations.
 */
interface MemoizeOptionsBase {
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
   * // Disable caching in test environment
   * @memoize({ enabled: Deno.env.get('DENO_ENV') !== 'test' })
   * get expensiveComputation(): number {
   *   return this.compute();
   * }
   * ```
   */
  enabled?: boolean;

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
   * fetchUserData(user: { id: string; name: string }): Promise<Data> {
   *   return this.fetch(user.id);
   * }
   *
   * // Combine multiple arguments into a key
   * @memoize({ keyFn: (a, b) => `${a}:${b}` })
   * compute(a: number, b: number): number {
   *   return a * b;
   * }
   * ```
   */
  keyFn?: (...args: unknown[]) => string;
}

/**
 * Options when TTL is specified - allows evictOnExpiry.
 */
interface MemoizeOptionsWithTtl extends MemoizeOptionsBase {
  /**
   * Time-to-live in milliseconds.
   *
   * After this duration, the cached value expires and will be recomputed
   * on the next access.
   *
   * @example
   * ```typescript
   * // Cache expires after 5 seconds
   * @memoize({ ttl: 5000 })
   * get freshData(): Data {
   *   return this.fetchData();
   * }
   * ```
   */
  ttl: number;

  /**
   * Whether to actively evict cached values when TTL expires.
   *
   * **When `true` (active eviction):**
   * - Schedules a `setTimeout` to delete the cached value from memory
   *   exactly when the TTL expires
   * - Ensures memory is freed even if the getter/method is never accessed again
   * - Useful for large cached values or memory-sensitive applications
   * - Slight overhead from timer management
   *
   * **When `false` (passive expiration, default):**
   * - Expired values remain in memory until the next access
   * - On access, checks if expired and recomputes if needed
   * - More memory-lazy but may keep stale data in memory longer
   * - No timer overhead
   *
   * @default false
   *
   * @example
   * ```typescript
   * // Active eviction - cache is cleared after 5 seconds even if never accessed
   * class ImageProcessor {
   *   @memoize({ ttl: 5000, evictOnExpiry: true })
   *   get largeImageBuffer(): Buffer {
   *     // Returns a 50MB buffer
   *     return fs.readFileSync('image.png');
   *   }
   * }
   *
   * // Passive expiration (default) - cache stays until next access
   * class ConfigService {
   *   @memoize({ ttl: 60000 })  // evictOnExpiry defaults to false
   *   get config(): Config {
   *     return this.loadConfig();
   *   }
   * }
   * ```
   */
  evictOnExpiry?: boolean;
}

/**
 * Options when TTL is not specified - evictOnExpiry is not allowed.
 */
interface MemoizeOptionsWithoutTtl extends MemoizeOptionsBase {
  /**
   * TTL is not specified.
   */
  ttl?: undefined;

  /**
   * evictOnExpiry cannot be set without ttl.
   *
   * This prevents nonsensical configurations like:
   * `@memoize({ evictOnExpiry: true })`  // Error: no TTL to evict on!
   */
  evictOnExpiry?: never;
}

/**
 * Options for configuring the memoize decorator behavior.
 *
 * This is a discriminated union that enforces type safety:
 * - When `ttl` is specified, `evictOnExpiry` may optionally be set
 * - When `ttl` is not specified, `evictOnExpiry` cannot be set
 *
 * @example Valid configurations
 * ```typescript
 * @memoize({ ttl: 5000, evictOnExpiry: true })   // ✅
 * @memoize({ ttl: 5000 })                        // ✅ evictOnExpiry defaults false
 * @memoize({})                                   // ✅ No TTL, no eviction
 * ```
 *
 * @example Invalid configuration (TypeScript error)
 * ```typescript
 * @memoize({ evictOnExpiry: true })              // ❌ Error: requires ttl!
 * ```
 */
export type MemoizeOptions = MemoizeOptionsWithTtl | MemoizeOptionsWithoutTtl;

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
