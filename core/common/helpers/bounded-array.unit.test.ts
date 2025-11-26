import { assert, assertFalse, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isBoundedArray,
  asBoundedArray,
  type BoundedArray,
} from "./bounded-array.ts";

describe("BoundedArray", () => {
  describe("compile-time type constraints", () => {
    it("accepts arrays within bounds", () => {
      const one: BoundedArray<string, 1, 3> = ["a"];
      const two: BoundedArray<string, 1, 3> = ["a", "b"];
      const three: BoundedArray<string, 1, 3> = ["a", "b", "c"];

      assertEquals(one.length, 1);
      assertEquals(two.length, 2);
      assertEquals(three.length, 3);
    });

    it("supports same min and max for fixed-length arrays", () => {
      const pair: BoundedArray<number, 2, 2> = [1, 2];
      const single: BoundedArray<string, 1, 1> = ["only"];

      assertEquals(pair.length, 2);
      assertEquals(single.length, 1);
    });

    it("supports minimum 0 (optional arrays)", () => {
      const empty: BoundedArray<string, 0, 2> = [];
      const one: BoundedArray<string, 0, 2> = ["a"];

      assertEquals(empty.length, 0);
      assertEquals(one.length, 1);
    });

    it("works with different element types", () => {
      const numbers: BoundedArray<number, 2, 4> = [1, 2, 3];
      const booleans: BoundedArray<boolean, 1, 2> = [true, false];
      const objects: BoundedArray<{ id: number }, 1, 2> = [{ id: 1 }];

      assert(numbers.length >= 2 && numbers.length <= 4);
      assert(booleans.length >= 1 && booleans.length <= 2);
      assert(objects.length >= 1 && objects.length <= 2);
    });

    it("retains standard array methods", () => {
      const arr: BoundedArray<number, 1, 3> = [1, 2];

      assert(arr.includes(1));
      assertEquals(arr.indexOf(2), 1);
      assertEquals(
        arr.map((x) => x * 2),
        [2, 4]
      );
      assertEquals(
        arr.filter((x) => x > 1),
        [2]
      );
    });

    // The following would cause compile-time errors if uncommented:
    // const empty: BoundedArray<string, 1, 3> = [];              // ❌ Too few
    // const tooMany: BoundedArray<string, 1, 3> = ["a","b","c","d"]; // ❌ Too many
  });

  describe("isBoundedArray", () => {
    describe("valid cases", () => {
      it("returns true for arrays within bounds", () => {
        assert(isBoundedArray(["a"], 1, 3));
        assert(isBoundedArray(["a", "b"], 1, 3));
        assert(isBoundedArray(["a", "b", "c"], 1, 3));
      });

      it("returns true for arrays at exact min bound", () => {
        assert(isBoundedArray([1], 1, 5));
        assert(isBoundedArray([1, 2], 2, 5));
      });

      it("returns true for arrays at exact max bound", () => {
        assert(isBoundedArray([1, 2, 3, 4, 5], 1, 5));
        assert(isBoundedArray([1, 2], 1, 2));
      });

      it("returns true for fixed-length bounds (min === max)", () => {
        assert(isBoundedArray([1], 1, 1));
        assert(isBoundedArray([1, 2], 2, 2));
        assert(isBoundedArray([1, 2, 3], 3, 3));
      });

      it("returns true for empty arrays when min is 0", () => {
        assert(isBoundedArray([], 0, 0));
        assert(isBoundedArray([], 0, 3));
        assert(isBoundedArray([], 0, 100));
      });

      it("works with different element types", () => {
        assert(isBoundedArray([1, 2, 3], 1, 5));
        assert(isBoundedArray([true, false], 1, 2));
        assert(isBoundedArray([{ id: 1 }, { id: 2 }], 1, 3));
        assert(isBoundedArray([null, undefined], 1, 5));
      });

      it("narrows type correctly in conditionals", () => {
        const arr: string[] = ["a", "b"];

        if (isBoundedArray(arr, 1, 3)) {
          // TypeScript now knows arr is BoundedArray<string, 1, 3>
          const bounded: BoundedArray<string, 1, 3> = arr;
          assert(bounded.length >= 1 && bounded.length <= 3);
        }
      });
    });

    describe("invalid cases - array length", () => {
      it("returns false for empty arrays when min > 0", () => {
        assertFalse(isBoundedArray([], 1, 3));
        assertFalse(isBoundedArray([], 1, 1));
        assertFalse(isBoundedArray([], 5, 10));
      });

      it("returns false for arrays below min", () => {
        assertFalse(isBoundedArray([1], 2, 5));
        assertFalse(isBoundedArray([1, 2], 3, 5));
        assertFalse(isBoundedArray(["a"], 5, 10));
      });

      it("returns false for arrays exceeding max", () => {
        assertFalse(isBoundedArray([1, 2, 3, 4], 1, 3));
        assertFalse(isBoundedArray(["a", "b", "c"], 1, 2));
        assertFalse(isBoundedArray([1, 2, 3, 4, 5, 6], 1, 5));
      });
    });

    describe("invalid cases - bounds parameters", () => {
      it("returns false for negative min", () => {
        assertFalse(isBoundedArray([1, 2], -1, 3));
        assertFalse(isBoundedArray([1], -5, 5));
      });

      it("returns false when min > max", () => {
        assertFalse(isBoundedArray([1, 2], 5, 3));
        assertFalse(isBoundedArray([1], 10, 5));
        assertFalse(isBoundedArray([], 1, 0));
      });

      it("returns false for non-integer min", () => {
        assertFalse(isBoundedArray([1, 2], 1.5, 3));
        assertFalse(isBoundedArray([1], 0.1, 5));
      });

      it("returns false for non-integer max", () => {
        assertFalse(isBoundedArray([1, 2], 1, 3.5));
        assertFalse(isBoundedArray([1], 1, 2.9));
      });

      it("returns false for NaN bounds", () => {
        assertFalse(isBoundedArray([1, 2], NaN, 3));
        assertFalse(isBoundedArray([1, 2], 1, NaN));
        assertFalse(isBoundedArray([1, 2], NaN, NaN));
      });

      it("returns false for Infinity bounds", () => {
        assertFalse(isBoundedArray([1, 2], Infinity, 3));
        assertFalse(isBoundedArray([1, 2], 1, Infinity));
        assertFalse(isBoundedArray([1, 2], -Infinity, Infinity));
      });
    });
  });

  describe("asBoundedArray", () => {
    describe("valid cases", () => {
      it("returns the same array cast to BoundedArray", () => {
        const input = ["a", "b"];
        const result = asBoundedArray(input, 1, 3);

        assertEquals(result, input);
        assertEquals(result.length, 2);
      });

      it("returns arrays at exact bounds", () => {
        const atMin = asBoundedArray([1], 1, 3);
        const atMax = asBoundedArray([1, 2, 3], 1, 3);

        assertEquals(atMin.length, 1);
        assertEquals(atMax.length, 3);
      });

      it("works with fixed-length bounds", () => {
        const fixed = asBoundedArray([1, 2], 2, 2);

        assertEquals(fixed.length, 2);
      });

      it("works with empty arrays when min is 0", () => {
        const empty = asBoundedArray([], 0, 3);

        assertEquals(empty.length, 0);
      });

      it("preserves array methods on returned value", () => {
        const arr = asBoundedArray([1, 2, 3], 1, 5);

        assertEquals(
          arr.map((x) => x * 2),
          [2, 4, 6]
        );
        assertEquals(
          arr.filter((x) => x > 1),
          [2, 3]
        );
        assert(arr.includes(2));
      });
    });

    describe("error cases", () => {
      it("throws for empty arrays when min > 0", () => {
        assertThrows(
          () => asBoundedArray([], 1, 3),
          Error,
          "Array length 0 not in bounds [1, 3]"
        );
      });

      it("throws for arrays below min", () => {
        assertThrows(
          () => asBoundedArray([1], 2, 5),
          Error,
          "Array length 1 not in bounds [2, 5]"
        );
      });

      it("throws for arrays exceeding max", () => {
        assertThrows(
          () => asBoundedArray([1, 2, 3, 4], 1, 3),
          Error,
          "Array length 4 not in bounds [1, 3]"
        );
      });

      it("throws for invalid bounds (min > max)", () => {
        assertThrows(
          () => asBoundedArray([1, 2], 5, 3),
          Error,
          "Array length 2 not in bounds [5, 3]"
        );
      });

      it("throws for negative min", () => {
        assertThrows(
          () => asBoundedArray([1, 2], -1, 3),
          Error,
          "Array length 2 not in bounds [-1, 3]"
        );
      });
    });
  });
});
