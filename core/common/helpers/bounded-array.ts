/**
 * Helper to create a fixed-length tuple.
 * @internal
 */
type Tuple<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : R["length"] extends 50
  ? T[]
  : Tuple<T, N, [T, ...R]>;

/**
 * Internal recursive type builder.
 * Only used when Min and Max are known literals.
 * @internal
 */
type BuildBoundedArray<
  T,
  Min extends number,
  Max extends number,
  Current extends T[] = Tuple<T, Min>,
  Result = Current
> = number extends Current["length"]
  ? T[]
  : Current["length"] extends Max
  ? Result
  : Current["length"] extends 50
  ? Result | T[]
  : BuildBoundedArray<T, Min, Max, [...Current, T], Result | [...Current, T]>;

/**
 * Defines an array that must contain a specific number of elements within a range (inclusive).
 *
 * Unlike a standard array (`T[]`) which can be empty or infinite, this type enforces
 * both a minimum and maximum length at compile time.
 *
 * @template T - The type of elements in the array (e.g., `string`, `number`).
 * @template Min - The minimum number of elements required.
 * @template Max - The maximum number of elements allowed.
 *
 * @example
 * // An array of strings that must have between 1 and 3 items:
 * type MyList = BoundedArray<string, 1, 3>;
 *
 * const a: MyList = ["a"];                // ✅ Valid (1 item)
 * const b: MyList = ["a", "b"];           // ✅ Valid (2 items)
 * const c: MyList = ["a", "b", "c"];      // ✅ Valid (3 items)
 *
 * const d: MyList = [];                   // ❌ Error: Length is 0 (min is 1)
 * const e: MyList = ["a", "b", "c", "d"]; // ❌ Error: Length is 4 (max is 3)
 *
 * @example
 * ```ts
 * // An array that can be empty or have up to 2 items:
 * type OptionalList = BoundedArray<string, 0, 2>;
 * const empty: OptionalList = [];         // ✅ Valid
 * const full: OptionalList = ["a", "b"];  // ✅ Valid
 * ```
 *
 * @example
 * ```ts
 * // Fixed-length array (min === max):
 * type ExactlyTwo = BoundedArray<string, 2, 2>;
 * const valid: ExactlyTwo = ["a", "b"];   // ✅ Valid
 * const invalid: ExactlyTwo = ["a"];      // ❌ Error: Length is 1 (not 2)
 * ```
 */
export type BoundedArray<T, Min extends number, Max extends number> =
  // If Min or Max are generic 'number' types (not literals), fallback to T[]
  // to prevent infinite recursion during type checking.
  number extends Min
    ? T[]
    : number extends Max
    ? T[]
    : // Otherwise, use the strict recursive tuple definition
      BuildBoundedArray<T, Min, Max> & T[];

/**
 * Checks at runtime whether an array's length falls within the specified bounds.
 *
 * When used in a conditional, this function acts as a type guard, narrowing
 * the array type to `BoundedArray<T, Min, Max>`.
 *
 * @template T - The type of elements in the array.
 * @template Min - The minimum length (inclusive).
 * @template Max - The maximum length (inclusive).
 * @param arr - The array to validate.
 * @param min - Minimum length. Must be a non-negative integer.
 * @param max - Maximum length. Must be >= min.
 * @returns `true` if the array length is within bounds, narrowing the type.
 *
 * @example
 * ```ts
 * const arr: string[] = ["a", "b"];
 *
 * if (isBoundedArray<string, 1, 3>(arr, 1, 3)) {
 *   // arr is now typed as BoundedArray<string, 1, 3>
 *   console.log(arr.length); // guaranteed 1-3
 * }
 * ```
 */
export function isBoundedArray<T, Min extends number, Max extends number>(
  arr: T[],
  min: Min,
  max: Max
): arr is BoundedArray<T, Min, Max> {
  return (
    Array.isArray(arr) &&
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 0 &&
    max >= min &&
    arr.length >= min &&
    arr.length <= max
  );
}

/**
 * Validates and casts an array to a `BoundedArray` type.
 *
 * Use this function when you have a runtime array and need to ensure it meets
 * the bounds before using it in a context that expects `BoundedArray<T, Min, Max>`.
 *
 * @template T - The type of elements in the array.
 * @template Min - The minimum length (inclusive).
 * @template Max - The maximum length (inclusive).
 * @param arr - The array to validate and cast.
 * @param min - Minimum length. Must be a non-negative integer.
 * @param max - Maximum length. Must be >= min.
 * @returns The same array, cast to `BoundedArray<T, Min, Max>`.
 * @throws {Error} If the array length is not within `[min, max]`.
 *
 * @example
 * ```ts
 * const input = ["a", "b"];
 * const bounded = asBoundedArray(input, 1, 3);
 * // bounded is now typed as BoundedArray<string, 1, 3>
 * ```
 *
 * @example
 * ```ts
 * // Throws an error:
 * asBoundedArray([], 1, 3);
 * // Error: Array length 0 not in bounds [1, 3]
 * ```
 */
export function asBoundedArray<T, Min extends number, Max extends number>(
  arr: T[],
  min: Min,
  max: Max
): BoundedArray<T, Min, Max> {
  if (!isBoundedArray(arr, min, max)) {
    throw new Error(
      `Array length ${arr.length} not in bounds [${min}, ${max}]`
    );
  }
  return arr as unknown as BoundedArray<T, Min, Max>;
}
