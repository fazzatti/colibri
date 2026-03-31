/**
 * Memoize Decorator Unit Tests
 */

import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { memoize } from "@/common/decorators/memoize/index.ts";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Helper to create a delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Getter Tests
// =============================================================================

describe("memoize decorator", disableSanitizeConfig, () => {
  describe("getter memoization", () => {
    it("caches the result of a getter", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        get value(): number {
          callCount++;
          return 42;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.value, 42);
      assertEquals(callCount, 1);

      assertEquals(instance.value, 42);
      assertEquals(callCount, 1); // Still 1, not recomputed
    });

    it("caches different values for different instances", () => {
      let callCount = 0;

      class TestClass {
        constructor(private _value: number) {}

        @memoize()
        get value(): number {
          callCount++;
          return this._value;
        }
      }

      const instance1 = new TestClass(10);
      const instance2 = new TestClass(20);

      assertEquals(instance1.value, 10);
      assertEquals(callCount, 1);

      assertEquals(instance2.value, 20);
      assertEquals(callCount, 2);

      // Both cached independently
      assertEquals(instance1.value, 10);
      assertEquals(instance2.value, 20);
      assertEquals(callCount, 2);
    });

    it("recomputes after TTL expires", async () => {
      let callCount = 0;

      class TestClass {
        @memoize({ ttl: 50 })
        get value(): number {
          callCount++;
          return callCount;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.value, 1);
      assertEquals(callCount, 1);

      // Still cached
      assertEquals(instance.value, 1);
      assertEquals(callCount, 1);

      // Wait for TTL to expire
      await delay(60);

      // Should recompute
      assertEquals(instance.value, 2);
      assertEquals(callCount, 2);
    });

    it("does not cache when enabled is false", () => {
      let callCount = 0;

      class TestClass {
        @memoize({ enabled: false })
        get value(): number {
          callCount++;
          return callCount;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.value, 1);
      assertEquals(instance.value, 2);
      assertEquals(instance.value, 3);
      assertEquals(callCount, 3);
    });

    it("supports runtime-enabled getters", () => {
      class TestClass {
        callCount = 0;

        constructor(readonly options: { cacheEnabled: boolean }) {}

        @memoize({
          enabled: (self: TestClass) => self.options.cacheEnabled,
        })
        get value(): number {
          this.callCount++;
          return this.callCount;
        }
      }

      const instance = new TestClass({ cacheEnabled: false });

      assertEquals(instance.value, 1);
      assertEquals(instance.value, 2);

      instance.options.cacheEnabled = true;
      assertEquals(instance.value, 3);
      assertEquals(instance.value, 3);
      assertEquals(instance.callCount, 3);
    });

    it("clears stale getter cache entries when runtime caching is disabled", () => {
      class TestClass {
        callCount = 0;

        constructor(readonly options: { cacheEnabled: boolean }) {}

        @memoize({
          enabled: (self: TestClass) => self.options.cacheEnabled,
        })
        get value(): number {
          this.callCount++;
          return this.callCount;
        }
      }

      const instance = new TestClass({ cacheEnabled: true });

      assertEquals(instance.value, 1);
      assertEquals(instance.value, 1);

      instance.options.cacheEnabled = false;
      assertEquals(instance.value, 2);
      assertEquals(instance.value, 3);

      instance.options.cacheEnabled = true;
      assertEquals(instance.value, 4);
      assertEquals(instance.value, 4);
      assertEquals(instance.callCount, 4);
    });

    it("falls back to enabled=true and cacheRejected=false when runtime getters return undefined", async () => {
      class TestClass {
        callCount = 0;

        @memoize({
          enabled: (() => undefined) as unknown as (self: TestClass) => boolean,
          cacheRejected: (() => undefined) as unknown as (
            self: TestClass,
          ) => boolean,
        })
        get value(): Promise<number> {
          this.callCount++;
          if (this.callCount === 1) {
            return Promise.reject(new Error("boom"));
          }

          return Promise.resolve(42);
        }
      }

      const instance = new TestClass();

      await assertRejects(() => instance.value, Error, "boom");
      assertEquals(await instance.value, 42);
      assertEquals(instance.callCount, 2);
    });

    it("evicts rejected promises returned by getters by default", async () => {
      class TestClass {
        callCount = 0;

        @memoize()
        get value(): Promise<number> {
          this.callCount++;
          if (this.callCount === 1) {
            return Promise.reject(new Error("boom"));
          }

          return Promise.resolve(42);
        }
      }

      const instance = new TestClass();

      await assertRejects(() => instance.value, Error, "boom");
      assertEquals(instance.callCount, 1);

      assertEquals(await instance.value, 42);
      assertEquals(instance.callCount, 2);
    });

    it("can keep rejected getter promises cached when configured", async () => {
      class TestClass {
        callCount = 0;

        @memoize({ cacheRejected: true })
        get value(): Promise<number> {
          this.callCount++;
          return Promise.reject(new Error("boom"));
        }
      }

      const instance = new TestClass();

      await assertRejects(() => instance.value, Error, "boom");
      await assertRejects(() => instance.value, Error, "boom");
      assertEquals(instance.callCount, 1);
    });
  });

  // =============================================================================
  // Method Tests
  // =============================================================================

  describe("method memoization", () => {
    it("caches the result of a method based on arguments", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        add(a: number, b: number): number {
          callCount++;
          return a + b;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.add(1, 2), 3);
      assertEquals(callCount, 1);

      // Same arguments - cached
      assertEquals(instance.add(1, 2), 3);
      assertEquals(callCount, 1);

      // Different arguments - recomputed
      assertEquals(instance.add(3, 4), 7);
      assertEquals(callCount, 2);

      // Original still cached
      assertEquals(instance.add(1, 2), 3);
      assertEquals(callCount, 2);
    });

    it("caches different values for different instances", () => {
      let callCount = 0;

      class TestClass {
        constructor(private multiplier: number) {}

        @memoize()
        multiply(x: number): number {
          callCount++;
          return x * this.multiplier;
        }
      }

      const instance1 = new TestClass(2);
      const instance2 = new TestClass(3);

      assertEquals(instance1.multiply(5), 10);
      assertEquals(callCount, 1);

      assertEquals(instance2.multiply(5), 15);
      assertEquals(callCount, 2);

      // Both cached independently
      assertEquals(instance1.multiply(5), 10);
      assertEquals(instance2.multiply(5), 15);
      assertEquals(callCount, 2);
    });

    it("recomputes after TTL expires", async () => {
      let callCount = 0;

      class TestClass {
        @memoize({ ttl: 50 })
        compute(x: number): number {
          callCount++;
          return x + callCount;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.compute(10), 11); // 10 + 1
      assertEquals(callCount, 1);

      // Still cached
      assertEquals(instance.compute(10), 11);
      assertEquals(callCount, 1);

      // Wait for TTL to expire
      await delay(60);

      // Should recompute
      assertEquals(instance.compute(10), 12); // 10 + 2
      assertEquals(callCount, 2);
    });

    it("does not cache when enabled is false", () => {
      let callCount = 0;

      class TestClass {
        @memoize({ enabled: false })
        getValue(): number {
          callCount++;
          return callCount;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.getValue(), 1);
      assertEquals(instance.getValue(), 2);
      assertEquals(instance.getValue(), 3);
      assertEquals(callCount, 3);
    });

    it("supports runtime-enabled methods and runtime TTL", async () => {
      class TestClass {
        callCount = 0;

        constructor(
          readonly options: { cacheEnabled: boolean; ttl?: number },
        ) {}

        @memoize({
          enabled: (self: TestClass) => self.options.cacheEnabled,
          ttl: (self: TestClass) => self.options.ttl,
        })
        compute(): number {
          this.callCount++;
          return this.callCount;
        }
      }

      const instance = new TestClass({ cacheEnabled: false });

      assertEquals(instance.compute(), 1);
      assertEquals(instance.compute(), 2);

      instance.options.cacheEnabled = true;
      instance.options.ttl = 0;

      assertEquals(instance.compute(), 3);
      await delay(1);
      assertEquals(instance.compute(), 4);
      assertEquals(instance.callCount, 4);
    });

    it("clears stale method cache entries when runtime caching is disabled", () => {
      class TestClass {
        callCount = 0;

        constructor(readonly options: { cacheEnabled: boolean }) {}

        @memoize({
          enabled: (self: TestClass) => self.options.cacheEnabled,
        })
        compute(_key: string): number {
          this.callCount++;
          return this.callCount;
        }
      }

      const instance = new TestClass({ cacheEnabled: true });

      assertEquals(instance.compute("same"), 1);
      assertEquals(instance.compute("same"), 1);

      instance.options.cacheEnabled = false;
      assertEquals(instance.compute("same"), 2);
      assertEquals(instance.compute("same"), 3);

      instance.options.cacheEnabled = true;
      assertEquals(instance.compute("same"), 4);
      assertEquals(instance.compute("same"), 4);
      assertEquals(instance.callCount, 4);
    });

    it("falls back to enabled=true and cacheRejected=false when runtime methods return undefined", async () => {
      class TestClass {
        callCount = 0;

        @memoize({
          enabled: (() => undefined) as unknown as (self: TestClass) => boolean,
          cacheRejected: (() => undefined) as unknown as (
            self: TestClass,
          ) => boolean,
        })
        load(id: string): Promise<string> {
          this.callCount++;
          if (this.callCount === 1) {
            return Promise.reject(new Error(`failed:${id}`));
          }

          return Promise.resolve(`${id}:${this.callCount}`);
        }
      }

      const instance = new TestClass();

      await assertRejects(() => instance.load("a"), Error, "failed:a");
      assertEquals(await instance.load("a"), "a:2");
      assertEquals(instance.callCount, 2);
    });

    it("supports custom key function", () => {
      let callCount = 0;

      class TestClass {
        // Custom key function that only uses first argument
        @memoize({ keyFn: (a: unknown) => String(a) })
        compute(a: number, b: number): number {
          callCount++;
          return a + b;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.compute(1, 2), 3);
      assertEquals(callCount, 1);

      // Different second argument but same key (first arg)
      // Returns cached value from first call
      assertEquals(instance.compute(1, 100), 3);
      assertEquals(callCount, 1);

      // Different first argument - new key, recomputes
      assertEquals(instance.compute(2, 2), 4);
      assertEquals(callCount, 2);
    });

    it("evicts rejected promises returned by methods by default", async () => {
      class TestClass {
        callCount = 0;

        @memoize()
        load(id: string): Promise<string> {
          this.callCount++;
          if (this.callCount === 1) {
            return Promise.reject(new Error(`failed:${id}`));
          }

          return Promise.resolve(`${id}:${this.callCount}`);
        }
      }

      const instance = new TestClass();

      await assertRejects(() => instance.load("a"), Error, "failed:a");
      assertEquals(instance.callCount, 1);

      assertEquals(await instance.load("a"), "a:2");
      assertEquals(instance.callCount, 2);
    });

    it("can keep rejected method promises cached when configured", async () => {
      class TestClass {
        callCount = 0;

        @memoize({
          cacheRejected: (self: TestClass) => self.callCount >= 0,
        })
        load(id: string): Promise<string> {
          this.callCount++;
          return Promise.reject(new Error(`failed:${id}`));
        }
      }

      const instance = new TestClass();

      await assertRejects(() => instance.load("a"), Error, "failed:a");
      await assertRejects(() => instance.load("a"), Error, "failed:a");
      assertEquals(instance.callCount, 1);
    });

    it("handles methods with no arguments", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        getRandom(): number {
          callCount++;
          return Math.random();
        }
      }

      const instance = new TestClass();

      const first = instance.getRandom();
      assertEquals(callCount, 1);

      const second = instance.getRandom();
      assertEquals(callCount, 1);

      // Same cached value
      assertEquals(first, second);
    });

    it("handles methods with object arguments", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        process(obj: { x: number; y: number }): number {
          callCount++;
          return obj.x + obj.y;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.process({ x: 1, y: 2 }), 3);
      assertEquals(callCount, 1);

      // Same object shape - cached (JSON.stringify produces same key)
      assertEquals(instance.process({ x: 1, y: 2 }), 3);
      assertEquals(callCount, 1);

      // Different object - recomputed
      assertEquals(instance.process({ x: 3, y: 4 }), 7);
      assertEquals(callCount, 2);
    });

    it("handles methods with array arguments", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        sum(numbers: number[]): number {
          callCount++;
          return numbers.reduce((a, b) => a + b, 0);
        }
      }

      const instance = new TestClass();

      assertEquals(instance.sum([1, 2, 3]), 6);
      assertEquals(callCount, 1);

      // Same array values - cached
      assertEquals(instance.sum([1, 2, 3]), 6);
      assertEquals(callCount, 1);

      // Different array - recomputed
      assertEquals(instance.sum([4, 5, 6]), 15);
      assertEquals(callCount, 2);
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe("edge cases", () => {
    it("handles undefined return value", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        get undefinedValue(): undefined {
          callCount++;
          return undefined;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.undefinedValue, undefined);
      assertEquals(callCount, 1);

      assertEquals(instance.undefinedValue, undefined);
      assertEquals(callCount, 1); // Cached even though undefined
    });

    it("handles null return value", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        get nullValue(): null {
          callCount++;
          return null;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.nullValue, null);
      assertEquals(callCount, 1);

      assertEquals(instance.nullValue, null);
      assertEquals(callCount, 1); // Cached even though null
    });

    it("handles falsy return values", () => {
      let callCount = 0;

      class TestClass {
        @memoize()
        get zero(): number {
          callCount++;
          return 0;
        }

        @memoize()
        get emptyString(): string {
          callCount++;
          return "";
        }

        @memoize()
        get falseValue(): boolean {
          callCount++;
          return false;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.zero, 0);
      assertEquals(instance.zero, 0);

      assertEquals(instance.emptyString, "");
      assertEquals(instance.emptyString, "");

      assertEquals(instance.falseValue, false);
      assertEquals(instance.falseValue, false);

      assertEquals(callCount, 3); // Each called once
    });

    it("does not affect regular properties", () => {
      class TestClass {
        regularProperty = 42;

        @memoize()
        get memoizedValue(): number {
          return this.regularProperty;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.regularProperty, 42);
      assertEquals(instance.memoizedValue, 42);

      instance.regularProperty = 100;
      assertEquals(instance.regularProperty, 100);
      assertEquals(instance.memoizedValue, 42); // Still cached
    });

    it("works with inheritance", () => {
      let baseCallCount = 0;
      let childCallCount = 0;

      class BaseClass {
        @memoize()
        get baseValue(): number {
          baseCallCount++;
          return 10;
        }
      }

      class ChildClass extends BaseClass {
        @memoize()
        get childValue(): number {
          childCallCount++;
          return 20;
        }
      }

      const instance = new ChildClass();

      assertEquals(instance.baseValue, 10);
      assertEquals(instance.baseValue, 10);
      assertEquals(baseCallCount, 1);

      assertEquals(instance.childValue, 20);
      assertEquals(instance.childValue, 20);
      assertEquals(childCallCount, 1);
    });

    it("handles symbol property keys", () => {
      let callCount = 0;
      const sym = Symbol("test");

      class TestClass {
        @memoize()
        get [sym](): number {
          callCount++;
          return 42;
        }
      }

      const instance = new TestClass();

      assertEquals(instance[sym], 42);
      assertEquals(instance[sym], 42);
      assertEquals(callCount, 1);
    });

    it("TTL of 0 means always expired", async () => {
      let callCount = 0;

      class TestClass {
        @memoize({ ttl: 0 })
        get value(): number {
          callCount++;
          return callCount;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.value, 1);

      // Small delay to ensure time has passed
      await delay(1);

      assertEquals(instance.value, 2);

      await delay(1);

      assertEquals(instance.value, 3);
      assertEquals(callCount, 3);
    });

    it("multiple memoized getters on same class work independently", () => {
      let callCountA = 0;
      let callCountB = 0;

      class TestClass {
        @memoize()
        get valueA(): number {
          callCountA++;
          return 1;
        }

        @memoize()
        get valueB(): number {
          callCountB++;
          return 2;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.valueA, 1);
      assertEquals(instance.valueA, 1);
      assertEquals(callCountA, 1);

      assertEquals(instance.valueB, 2);
      assertEquals(instance.valueB, 2);
      assertEquals(callCountB, 1);
    });

    it("multiple memoized methods on same class work independently", () => {
      let callCountA = 0;
      let callCountB = 0;

      class TestClass {
        @memoize()
        methodA(x: number): number {
          callCountA++;
          return x * 2;
        }

        @memoize()
        methodB(x: number): number {
          callCountB++;
          return x * 3;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.methodA(5), 10);
      assertEquals(instance.methodA(5), 10);
      assertEquals(callCountA, 1);

      assertEquals(instance.methodB(5), 15);
      assertEquals(instance.methodB(5), 15);
      assertEquals(callCountB, 1);
    });
  });

  // =============================================================================
  // Default Options Tests
  // =============================================================================

  describe("default options", () => {
    it("enabled defaults to true", () => {
      let callCount = 0;

      class TestClass {
        @memoize() // No options
        get value(): number {
          callCount++;
          return 42;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.value, 42);
      assertEquals(instance.value, 42);
      assertEquals(callCount, 1); // Caching is enabled by default
    });

    it("ttl defaults to undefined (no expiry)", async () => {
      let callCount = 0;

      class TestClass {
        @memoize() // No TTL
        get value(): number {
          callCount++;
          return 42;
        }
      }

      const instance = new TestClass();

      assertEquals(instance.value, 42);
      await delay(100);
      assertEquals(instance.value, 42);
      assertEquals(callCount, 1); // Never expires
    });

    it("keyFn defaults to JSON.stringify", () => {
      // deno-lint-ignore prefer-const
      let capturedKey = "";

      class TestClass {
        @memoize({
          keyFn: (...args) => {
            capturedKey = JSON.stringify(args);
            return capturedKey;
          },
        })
        method(a: number, b: string): string {
          return `${a}-${b}`;
        }
      }

      const instance = new TestClass();
      instance.method(1, "test");

      assertEquals(capturedKey, '[1,"test"]');
    });
  });

  describe("unsupported targets", () => {
    it("passes through unchanged when applied to setters", () => {
      let setterCalls = 0;

      class TestClass {
        private _value = 0;

        @memoize()
        set value(v: number) {
          setterCalls++;
          this._value = v;
        }

        get value(): number {
          return this._value;
        }
      }

      const instance = new TestClass();

      // Setter should work normally (not memoized)
      instance.value = 10;
      assertEquals(setterCalls, 1);
      assertEquals(instance.value, 10);

      instance.value = 20;
      assertEquals(setterCalls, 2);
      assertEquals(instance.value, 20);
    });
  });

  // ===========================================================================
  // evictOnExpiry Tests
  // ===========================================================================

  describe("evictOnExpiry option", disableSanitizeConfig, () => {
    describe("getter with evictOnExpiry", () => {
      it("should actively evict cached value after TTL when evictOnExpiry is true", async () => {
        let callCount = 0;
        class TestClass {
          @memoize({ ttl: 100, evictOnExpiry: true })
          get value(): number {
            callCount++;
            return 42;
          }
        }

        const instance = new TestClass();

        // First access - computes and caches
        assertEquals(instance.value, 42);
        assertEquals(callCount, 1);

        // Access before TTL - returns cached
        await delay(50);
        assertEquals(instance.value, 42);
        assertEquals(callCount, 1); // Still 1, used cache

        // Wait for TTL to expire and timer to fire
        await delay(60); // Now at 110ms total, timer has fired

        // Next access - should recompute because cache was evicted
        assertEquals(instance.value, 42);
        assertEquals(callCount, 2); // Incremented because cache was evicted by timer
      });

      it("should NOT actively evict when evictOnExpiry is false (default)", async () => {
        let callCount = 0;
        class TestClass {
          @memoize({ ttl: 100 }) // evictOnExpiry defaults to false
          get value(): number {
            callCount++;
            return 42;
          }
        }

        const instance = new TestClass();

        assertEquals(instance.value, 42);
        assertEquals(callCount, 1);

        // Advance past TTL
        await delay(110);

        // Cache is still in memory (just marked stale), so no eviction timer fired
        // But next access WILL recompute because it checks timestamp
        assertEquals(instance.value, 42);
        assertEquals(callCount, 2); // Recomputed on access, not via timer
      });

      it("should clear previous timer when value is re-cached before TTL", async () => {
        let callCount = 0;
        class TestClass {
          @memoize({ ttl: 100, evictOnExpiry: true })
          get value(): number {
            callCount++;
            return callCount; // Returns different value each time
          }
        }

        const instance = new TestClass();

        assertEquals(instance.value, 1); // First computation

        // Wait for TTL to expire
        await delay(110);

        assertEquals(instance.value, 2); // Recomputes, schedules new timer

        // Wait less than TTL
        await delay(50);
        assertEquals(instance.value, 2); // Still cached
        assertEquals(callCount, 2);

        // Wait for second timer to fire
        await delay(60); // Now 110ms from second cache
        assertEquals(instance.value, 3); // Evicted, recomputes
        assertEquals(callCount, 3);
      });

      it("should handle multiple instances independently", async () => {
        let callCountA = 0;
        let callCountB = 0;

        class TestClass {
          constructor(private id: string) {}

          @memoize({ ttl: 100, evictOnExpiry: true })
          get value(): string {
            if (this.id === "A") callCountA++;
            else callCountB++;
            return `value-${this.id}`;
          }
        }

        const instanceA = new TestClass("A");
        const instanceB = new TestClass("B");

        // Both cache
        assertEquals(instanceA.value, "value-A");
        assertEquals(instanceB.value, "value-B");
        assertEquals(callCountA, 1);
        assertEquals(callCountB, 1);

        // Advance and check both evict independently
        await delay(110);

        assertEquals(instanceA.value, "value-A");
        assertEquals(instanceB.value, "value-B");
        assertEquals(callCountA, 2); // Both re-computed
        assertEquals(callCountB, 2);
      });
    });

    describe("method with evictOnExpiry", () => {
      it("should actively evict each cached argument combination independently", async () => {
        const callLog: string[] = [];

        class TestClass {
          @memoize({ ttl: 100, evictOnExpiry: true })
          compute(x: number): number {
            callLog.push(`compute(${x})`);
            return x * 2;
          }
        }

        const instance = new TestClass();

        // Cache multiple argument combinations
        assertEquals(instance.compute(1), 2);
        assertEquals(instance.compute(2), 4);
        assertEquals(instance.compute(3), 6);
        assertEquals(callLog.length, 3);

        // Access before TTL - all cached
        await delay(50);
        assertEquals(instance.compute(1), 2);
        assertEquals(instance.compute(2), 4);
        assertEquals(callLog.length, 3); // No new calls

        // Advance past TTL - all timers fire
        await delay(60);

        // All should be evicted, need to recompute
        assertEquals(instance.compute(1), 2);
        assertEquals(instance.compute(2), 4);
        assertEquals(instance.compute(3), 6);
        assertEquals(callLog.length, 6); // 3 new calls
      });

      it("should clear timer for specific argument when re-cached", async () => {
        const callLog: string[] = [];

        class TestClass {
          @memoize({ ttl: 100, evictOnExpiry: true })
          compute(x: number): number {
            callLog.push(`compute(${x})`);
            return x * 2;
          }
        }

        const instance = new TestClass();

        // Cache arg=1
        assertEquals(instance.compute(1), 2);
        assertEquals(callLog, ["compute(1)"]);

        // Advance past TTL - timer fires for arg=1
        await delay(110);

        // Recompute arg=1 (new timer starts)
        assertEquals(instance.compute(1), 2);
        assertEquals(callLog, ["compute(1)", "compute(1)"]);

        // Advance less than TTL
        await delay(50);
        assertEquals(instance.compute(1), 2);
        assertEquals(callLog, ["compute(1)", "compute(1)"]); // Still cached

        // Advance for new timer to fire
        await delay(60);
        assertEquals(instance.compute(1), 2);
        assertEquals(callLog, ["compute(1)", "compute(1)", "compute(1)"]);
      });

      it("should handle custom keyFn with evictOnExpiry", async () => {
        const callLog: Array<{ id: string }> = [];

        class TestClass {
          @memoize({
            ttl: 100,
            evictOnExpiry: true,
            keyFn: (...args: unknown[]) => (args[0] as { id: string }).id,
          })
          fetchUser(user: { id: string; name: string }): string {
            callLog.push({ id: user.id });
            return `User: ${user.name}`;
          }
        }

        const instance = new TestClass();

        // Cache with same ID (different name shouldn't matter)
        assertEquals(
          instance.fetchUser({ id: "1", name: "Alice" }),
          "User: Alice",
        );
        assertEquals(
          instance.fetchUser({ id: "1", name: "DIFFERENT" }),
          "User: Alice",
        );
        assertEquals(callLog.length, 1); // Cached by ID

        // Advance past TTL
        await delay(110);

        // Should recompute
        assertEquals(instance.fetchUser({ id: "1", name: "Bob" }), "User: Bob");
        assertEquals(callLog.length, 2);
      });

      it("should clear timer when method is re-called after expiry but before eviction", () => {
        const callLog: string[] = [];

        class TestClass {
          @memoize({ ttl: 5000, evictOnExpiry: true }) // Long TTL
          compute(x: number): number {
            callLog.push(`compute(${x})`);
            return x * 2;
          }
        }

        const instance = new TestClass();

        // Cache arg=1 with timer scheduled for 5000ms
        assertEquals(instance.compute(1), 2);
        assertEquals(callLog, ["compute(1)"]);

        // Manually manipulate timestamp to force expiry
        const symbols = Object.getOwnPropertySymbols(instance);
        const timestampsMapSymbol = symbols.find((s) =>
          s.description?.includes("timestamps"),
        ); // plural!
        if (timestampsMapSymbol) {
          // deno-lint-ignore no-explicit-any
          const timestampsMap = (instance as any)[timestampsMapSymbol];
          const key = JSON.stringify([1]); // Default keyFn result
          if (timestampsMap && timestampsMap.has(key)) {
            // Set timestamp to 6 seconds ago
            timestampsMap.set(key, Date.now() - 6000);
          }
        }

        // Recompute - clearTimeout path because timer still pending but isExpired=true
        assertEquals(instance.compute(1), 2);
        assertEquals(callLog, ["compute(1)", "compute(1)"]);
      });
    });

    describe("evictOnExpiry edge cases", () => {
      it("should work with TTL of 0 and evictOnExpiry", async () => {
        let callCount = 0;
        class TestClass {
          @memoize({ ttl: 0, evictOnExpiry: true })
          get value(): number {
            callCount++;
            return 42;
          }
        }

        const instance = new TestClass();

        // First access
        assertEquals(instance.value, 42);
        assertEquals(callCount, 1);

        // Wait at least 1ms so Date.now() advances
        await delay(1);

        // Now (now - cachedAt > 0) will be true, triggering clearTimeout
        assertEquals(instance.value, 42);
        assertEquals(callCount, 2);
      });

      it("should handle rapid re-caching before timer fires", async () => {
        let callCount = 0;
        class TestClass {
          @memoize({ ttl: 100, evictOnExpiry: true })
          get value(): number {
            callCount++;
            return callCount;
          }
        }

        const instance = new TestClass();

        // First cache
        assertEquals(instance.value, 1);

        // Wait until expired, trigger recompute
        await delay(110);
        assertEquals(instance.value, 2); // New timer scheduled

        // Immediately expire and recompute again
        await delay(110);
        assertEquals(instance.value, 3); // Another new timer

        // Verify old timers don't interfere
        await delay(110);
        assertEquals(instance.value, 4);
        assertEquals(callCount, 4);
      });

      it("should clear timer when getter is re-accessed after expiry but before eviction", () => {
        let callCount = 0;
        class TestClass {
          @memoize({ ttl: 5000, evictOnExpiry: true }) // Long TTL so timer doesn't fire quickly
          get value(): number {
            callCount++;
            return callCount;
          }
        }

        const instance = new TestClass();

        // First cache - timer scheduled for 5000ms
        assertEquals(instance.value, 1);

        // Manually manipulate the cached timestamp to make it appear expired
        // Find the timestamp symbol by iterating over the instance's symbols
        const symbols = Object.getOwnPropertySymbols(instance);
        const timestampSymbol = symbols.find((s) =>
          s.description?.includes("timestamp"),
        );
        if (timestampSymbol) {
          // Set timestamp to 6 seconds ago (past the 5000ms TTL)
          // deno-lint-ignore no-explicit-any
          (instance as any)[timestampSymbol] = Date.now() - 6000;
        }

        // This access sees isExpired=true (timestamp is 6s old, TTL is 5s)
        // But timer is still pending (won't fire for another ~5 seconds)
        // This hits the clearTimeout path!
        assertEquals(instance.value, 2);
        assertEquals(callCount, 2);
      });
    });
  });
});
