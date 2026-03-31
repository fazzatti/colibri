/**
 * @module memoize
 * @description A decorator for caching getter and method results.
 *
 * The memoize decorator provides automatic caching for class getters and methods:
 * - **Getters**: Caches a single value per instance
 * - **Methods**: Caches results keyed by arguments
 *
 * Features:
 * - Per-instance caching (different instances don't share cache)
 * - Optional TTL (time-to-live) for cache expiration
 * - **Active eviction** via `evictOnExpiry` option for memory management
 * - Runtime-resolved `enabled`, `ttl`, `evictOnExpiry`, and `cacheRejected`
 *   options based on the current instance
 * - Custom key functions for method argument hashing
 * - Rejected promises are evicted by default so later calls can retry
 * - Can be disabled for testing/debugging
 *
 * @example Basic usage
 * ```typescript
 * class Example {
 *   // Getter - caches single value
 *   @memoize()
 *   get expensiveValue(): number {
 *     return this.compute();
 *   }
 *
 *   // Method - caches by arguments
 *   @memoize()
 *   calculate(x: number, y: number): number {
 *     return x + y;
 *   }
 * }
 * ```
 *
 * @example TTL with passive expiration (default)
 * ```typescript
 * class DataService {
 *   // Cache expires after 5 seconds, but stays in memory until next access
 *   @memoize({ ttl: 5000 })
 *   get config(): Config {
 *     return this.loadConfig();
 *   }
 * }
 * ```
 *
 * @example TTL with active eviction
 * ```typescript
 * class ImageProcessor {
 *   // Cache is actively deleted after 5 seconds, freeing memory
 *   @memoize({ ttl: 5000, evictOnExpiry: true })
 *   get largeImageBuffer(): Buffer {
 *     // Returns a 50MB buffer
 *     return fs.readFileSync('image.png');
 *   }
 *
 *   // Also works with methods
 *   @memoize({ ttl: 10000, evictOnExpiry: true })
 *   processImage(path: string): ProcessedImage {
 *     return this.heavyProcessing(path);
 *   }
 * }
 * ```
 */

import type {
  DecoratorContext,
  MemoizeOptionResolver,
  MemoizeOptions,
} from "./types.ts";

/**
 * Default key function for method arguments.
 *
 * Uses `JSON.stringify` to create a cache key from the arguments array.
 * This works well for primitive values and simple objects, but may not
 * be suitable for complex objects or circular references.
 *
 * @param args - The arguments to convert to a cache key
 * @returns A string representation of the arguments
 * @internal
 */
const defaultKeyFn = (...args: unknown[]): string => {
  return JSON.stringify(args);
};

type RuntimeOptionArgs = unknown[];

const resolveOption = <Value>(
  option:
    | MemoizeOptionResolver<
      Value,
      Record<string | symbol, unknown>,
      RuntimeOptionArgs
    >
    | undefined,
  self: Record<string | symbol, unknown>,
  ...args: RuntimeOptionArgs
): Value | undefined => {
  if (typeof option === "function") {
    return (
      option as (
        self: Record<string | symbol, unknown>,
        ...args: RuntimeOptionArgs
      ) => Value
    )(self, ...args);
  }

  return option;
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function";

/**
 * Memoize decorator factory.
 *
 * Creates a decorator that caches the result of a getter or method.
 * The cache is stored per-instance, so different instances maintain
 * separate caches. Runtime-resolved options receive the current instance
 * (and method arguments for methods) on every access.
 *
 * @param options - Configuration options for memoization
 * @returns A decorator function that can be applied to getters or methods
 *
 * @example
 * ```typescript
 * class DataService {
 *   // Simple getter memoization
 *   @memoize()
 *   get config(): Config {
 *     return this.loadConfig();
 *   }
 *
 *   // Method with argument-based caching
 *   @memoize()
 *   getUserById(id: string): User {
 *     return this.fetchUser(id);
 *   }
 *
 *   // With 30-second TTL
 *   @memoize({ ttl: 30000 })
 *   get currentUser(): User {
 *     return this.fetchCurrentUser();
 *   }
 * }
 * ```
 */
export function memoize(
  options: MemoizeOptions = {},
): <T>(
  target: T,
  context: DecoratorContext,
) => T | void {
  const {
    enabled = true,
    ttl,
    keyFn = defaultKeyFn,
    cacheRejected = false,
  } = options;

  const evictOnExpiry = "evictOnExpiry" in options
    ? options.evictOnExpiry
    : undefined;

  return function <T>(
    target: T,
    context: DecoratorContext,
  ): T | void {
    // Preserve the current static-disabled shortcut while still supporting
    // runtime-resolved options when a function is provided.
    if (enabled === false) {
      return target;
    }

    const propertyKey = context.name;

    if (context.kind === "getter") {
      return memoizeGetter(
        target as () => unknown,
        propertyKey,
        enabled,
        ttl,
        evictOnExpiry,
        cacheRejected,
      ) as T;
    }

    if (context.kind === "method") {
      return memoizeMethod(
        target as (...args: unknown[]) => unknown,
        propertyKey,
        enabled,
        ttl,
        keyFn,
        evictOnExpiry,
        cacheRejected,
      ) as T;
    }

    // Not a getter or method - return unchanged
    return target;
  };
}

/**
 * Creates a memoized version of a getter function.
 *
 * The memoized getter caches its result on the instance using a unique symbol,
 * so different instances maintain separate cached values. If TTL is specified,
 * the cached value expires after the given duration.
 *
 * @typeParam T - The return type of the getter
 * @param originalGetter - The original getter function to memoize
 * @param propertyKey - The name of the property (used for debugging symbols)
 * @param ttl - Optional time-to-live in milliseconds
 * @returns A new getter function that caches its result
 * @internal
 */
function memoizeGetter<T>(
  originalGetter: () => T,
  propertyKey: string | symbol,
  enabled: MemoizeOptions["enabled"],
  ttl: MemoizeOptions["ttl"],
  evictOnExpiry: MemoizeOptions["evictOnExpiry"],
  cacheRejected: MemoizeOptions["cacheRejected"],
): () => T {
  // Create unique symbols for this specific property
  const cacheKey = Symbol(`memoize:${String(propertyKey)}:cache`);
  const timestampKey = Symbol(`memoize:${String(propertyKey)}:timestamp`);
  const timerKey = Symbol(`memoize:${String(propertyKey)}:timer`);

  const clearCache = (instance: Record<symbol, unknown>) => {
    if (instance[timerKey] !== undefined) {
      clearTimeout(instance[timerKey] as number);
      delete instance[timerKey];
    }
    delete instance[cacheKey];
    delete instance[timestampKey];
  };

  return function (this: Record<symbol, unknown>): T {
    const isEnabled = resolveOption(enabled, this) ?? true;
    if (!isEnabled) {
      return originalGetter.call(this);
    }

    const now = Date.now();
    const cachedAt = this[timestampKey] as number | undefined;
    const resolvedTtl = resolveOption(ttl, this);

    // Check if we have a valid cached value
    const hasCachedValue = cacheKey in this;
    const isExpired = resolvedTtl !== undefined &&
      cachedAt !== undefined &&
      now - cachedAt > resolvedTtl;

    if (!hasCachedValue || isExpired) {
      clearCache(this);

      const result = originalGetter.call(this);
      const shouldCacheRejected = resolveOption(cacheRejected, this) ?? false;
      this[cacheKey] = isPromiseLike(result) && !shouldCacheRejected
        ? Promise.resolve(result).catch((error) => {
          clearCache(this);
          throw error;
        })
        : result;
      this[timestampKey] = now;

      // Schedule active eviction if enabled
      const shouldEvictOnExpiry = resolveOption(evictOnExpiry, this) ?? false;
      if (resolvedTtl !== undefined && shouldEvictOnExpiry) {
        const timerId = setTimeout(() => {
          clearCache(this);
        }, resolvedTtl);

        this[timerKey] = timerId;
      }
    }

    return this[cacheKey] as T;
  };
}

/**
 * Creates a memoized version of a method function.
 *
 * The memoized method caches results in a Map keyed by the serialized arguments.
 * Each instance maintains its own cache Map using a unique symbol. If TTL is
 * specified, cached values expire independently based on when they were stored.
 *
 * @typeParam T - The function type being memoized
 * @param originalMethod - The original method function to memoize
 * @param propertyKey - The name of the method (used for debugging symbols)
 * @param ttl - Optional time-to-live in milliseconds
 * @param keyFn - Function to generate cache keys from arguments
 * @returns A new method function that caches results by arguments
 * @internal
 */
function memoizeMethod<T extends (...args: unknown[]) => unknown>(
  originalMethod: T,
  propertyKey: string | symbol,
  enabled: MemoizeOptions["enabled"],
  ttl: MemoizeOptions["ttl"],
  keyFn: (...args: unknown[]) => string = defaultKeyFn,
  evictOnExpiry: MemoizeOptions["evictOnExpiry"],
  cacheRejected: MemoizeOptions["cacheRejected"],
): T {
  // Create unique symbols for this specific property
  const cacheMapKey = Symbol(`memoize:${String(propertyKey)}:cache`);
  const timestampsMapKey = Symbol(`memoize:${String(propertyKey)}:timestamps`);
  const timersMapKey = Symbol(`memoize:${String(propertyKey)}:timers`);

  const memoizedMethod = function (
    this: Record<symbol, Map<string, unknown>>,
    ...args: unknown[]
  ): unknown {
    const isEnabled = resolveOption(enabled, this, ...args) ?? true;
    if (!isEnabled) {
      return originalMethod.apply(this, args);
    }

    // Initialize cache maps if needed
    if (!(cacheMapKey in this)) {
      this[cacheMapKey] = new Map();
    }
    if (!(timestampsMapKey in this)) {
      this[timestampsMapKey] = new Map();
    }
    if (!(timersMapKey in this)) {
      this[timersMapKey] = new Map();
    }

    const cacheMap = this[cacheMapKey];
    const timestampsMap = this[timestampsMapKey] as Map<string, number>;
    const timersMap = this[timersMapKey] as Map<string, number>;
    const key = keyFn(...args);
    const now = Date.now();
    const cachedAt = timestampsMap.get(key) as number | undefined;
    const resolvedTtl = resolveOption(ttl, this, ...args);

    const clearCacheEntry = () => {
      const existingTimer = timersMap.get(key);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        timersMap.delete(key);
      }

      cacheMap.delete(key);
      timestampsMap.delete(key);
    };

    // Check if we have a valid cached value
    const hasCachedValue = cacheMap.has(key);
    const isExpired = resolvedTtl !== undefined &&
      cachedAt !== undefined &&
      now - cachedAt > resolvedTtl;

    if (!hasCachedValue || isExpired) {
      clearCacheEntry();

      const result = originalMethod.apply(this, args);
      const shouldCacheRejected = resolveOption(cacheRejected, this, ...args) ??
        false;
      cacheMap.set(
        key,
        isPromiseLike(result) && !shouldCacheRejected
          ? Promise.resolve(result).catch((error) => {
            clearCacheEntry();
            throw error;
          })
          : result,
      );
      timestampsMap.set(key, now);

      // Schedule active eviction for this specific argument key
      const shouldEvictOnExpiry = resolveOption(evictOnExpiry, this, ...args) ??
        false;
      if (resolvedTtl !== undefined && shouldEvictOnExpiry) {
        const timerId = setTimeout(() => {
          clearCacheEntry();
        }, resolvedTtl);

        timersMap.set(key, timerId);
      }
    }

    return cacheMap.get(key);
  };

  return memoizedMethod as T;
}
