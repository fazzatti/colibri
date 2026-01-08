import { FAILED_TO_PARSE_XDR } from "@/common/helpers/xdr/error.ts";

/**
 * Ensures a value is a parsed XDR object of the specified type.
 *
 * This helper normalizes XDR input by accepting multiple formats and
 * returning a consistently parsed XDR object. It's useful when working
 * with APIs that may return XDR as base64 strings, binary data, or
 * already-parsed objects.
 *
 * **Input handling:**
 * - **Already parsed object** → Returns as-is (no parsing)
 * - **Base64 string** → Parses using `xdrType.fromXDR(value, "base64")`
 * - **Uint8Array** → Parses using `xdrType.fromXDR(value)`
 *
 * @template T - The XDR type to parse (e.g., `xdr.LedgerHeader`)
 * @param value - Input value in any supported format
 * @param xdrType - XDR type constructor (must have a `fromXDR` method)
 * @returns Parsed XDR object of type T
 * @throws {FAILED_TO_PARSE_XDR} If the value cannot be parsed as the specified XDR type
 *
 * @example
 * ```ts
 * // Parse from base64 string (common from RPC responses)
 * const header = ensureXdrType(headerXdr, xdr.LedgerHeader);
 *
 * // Pass through already-parsed object (idempotent)
 * const same = ensureXdrType(header, xdr.LedgerHeader); // Returns header unchanged
 *
 * // Parse from binary data
 * const meta = ensureXdrType(binaryData, xdr.LedgerCloseMeta);
 * ```
 */
export function ensureXdrType<T>(
  value: string | Uint8Array | T,
  xdrType: {
    fromXDR(xdr: string | Uint8Array, format?: string): T;
    name?: string;
  }
): T {
  // Already parsed
  if (typeof value === "object" && !(value instanceof Uint8Array)) {
    return value as T;
  }

  // Parse from string (base64) or Uint8Array
  try {
    if (typeof value === "string") {
      return xdrType.fromXDR(value, "base64");
    }
    return xdrType.fromXDR(value as Uint8Array);
  } catch (error) {
    throw new FAILED_TO_PARSE_XDR(
      typeof value,
      xdrType.name || "unknown",
      error instanceof Error ? error : undefined
    );
  }
}
