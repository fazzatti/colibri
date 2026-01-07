/**
 * Memoize Decorator Unit Tests
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
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

describe("memoize decorator", () => {
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
});
