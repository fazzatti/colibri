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
 * - Custom key functions for method argument hashing
 * - Can be disabled for testing/debugging
 *
 * @example
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
 *
 *   // With TTL (cache expires after 5 seconds)
 *   @memoize({ ttl: 5000 })
 *   get freshData(): Data {
 *     return this.fetchData();
 *   }
 *
 *   // Disabled (useful for testing/debugging)
 *   @memoize({ enabled: false })
 *   get alwaysRecompute(): number {
 *     return Math.random();
 *   }
 * }
 * ```
 */

import type { DecoratorContext, MemoizeOptions } from "./types.ts";

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

/**
 * Memoize decorator factory.
 *
 * Creates a decorator that caches the result of a getter or method.
 * The cache is stored per-instance, so different instances maintain
 * separate caches.
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
export function memoize(options: MemoizeOptions = {}) {
  const { enabled = true, ttl, keyFn = defaultKeyFn } = options;

  // deno-lint-ignore no-explicit-any
  return function <T extends (...args: any[]) => any>(
    target: T,
    context: DecoratorContext
  ): T | void {
    // If disabled, return original unchanged
    if (!enabled) {
      return target;
    }

    const propertyKey = context.name;

    if (context.kind === "getter") {
      return memoizeGetter(target, propertyKey, ttl) as T;
    }

    if (context.kind === "method") {
      return memoizeMethod(target, propertyKey, ttl, keyFn) as T;
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
  ttl?: number
): () => T {
  // Create unique symbols for this specific property
  const cacheKey = Symbol(`memoize:${String(propertyKey)}:cache`);
  const timestampKey = Symbol(`memoize:${String(propertyKey)}:timestamp`);

  return function (this: Record<symbol, unknown>): T {
    const now = Date.now();
    const cachedAt = this[timestampKey] as number | undefined;

    // Check if we have a valid cached value
    const hasCachedValue = cacheKey in this;
    const isExpired =
      ttl !== undefined && cachedAt !== undefined && now - cachedAt > ttl;

    if (!hasCachedValue || isExpired) {
      this[cacheKey] = originalGetter.call(this);
      this[timestampKey] = now;
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
  ttl?: number,
  keyFn: (...args: unknown[]) => string = defaultKeyFn
): T {
  // Create unique symbols for this specific property
  const cacheMapKey = Symbol(`memoize:${String(propertyKey)}:cache`);
  const timestampsMapKey = Symbol(`memoize:${String(propertyKey)}:timestamps`);

  const memoizedMethod = function (
    this: Record<symbol, Map<string, unknown>>,
    ...args: unknown[]
  ): unknown {
    // Initialize cache maps if needed
    if (!(cacheMapKey in this)) {
      this[cacheMapKey] = new Map();
    }
    if (!(timestampsMapKey in this)) {
      this[timestampsMapKey] = new Map();
    }

    const cacheMap = this[cacheMapKey];
    const timestampsMap = this[timestampsMapKey] as Map<string, number>;
    const key = keyFn(...args);
    const now = Date.now();
    const cachedAt = timestampsMap.get(key) as number | undefined;

    // Check if we have a valid cached value
    const hasCachedValue = cacheMap.has(key);
    const isExpired =
      ttl !== undefined && cachedAt !== undefined && now - cachedAt > ttl;

    if (!hasCachedValue || isExpired) {
      const result = originalMethod.apply(this, args);
      cacheMap.set(key, result);
      timestampsMap.set(key, now);
    }

    return cacheMap.get(key);
  };

  return memoizedMethod as T;
}
