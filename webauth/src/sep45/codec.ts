import { xdr } from "stellar-sdk";
import { Sep45Code, Sep45Error } from "@/error.ts";
import type { SorobanAuthorizationEntry } from "@/stellar-sdk-types.ts";

/** Decodes an exact variable-length Soroban authorization-entry array. */
export function decodeSep45AuthorizationEntries(
  value: string,
): SorobanAuthorizationEntry[] {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new Sep45Error({
      code: Sep45Code.INVALID_XDR,
      message: "Invalid SEP-45 authorization_entries encoding",
    });
  }

  try {
    const entries = xdr.decodeArray(
      xdr.SorobanAuthorizationEntry,
      value,
      "base64",
    );
    if (entries.length === 0) {
      throw new Sep45Error({
        code: Sep45Code.EMPTY_ENTRIES,
        message: "SEP-45 challenge contains no authorization entries",
      });
    }
    return entries;
  } catch (cause) {
    if (cause instanceof Sep45Error) {
      throw cause;
    }
    throw new Sep45Error({
      code: Sep45Code.INVALID_XDR,
      message: "Invalid SEP-45 authorization_entries XDR",
      cause,
    });
  }
}

/** Encodes a variable-length Soroban authorization-entry array. */
export function encodeSep45AuthorizationEntries(
  entries: SorobanAuthorizationEntry[],
): string {
  return xdr.encodeArray(
    xdr.SorobanAuthorizationEntry,
    entries,
    "base64",
  );
}

/** Deep-clones an authorization entry through XDR. */
export function cloneSep45AuthorizationEntry(
  entry: SorobanAuthorizationEntry,
): SorobanAuthorizationEntry {
  return xdr.SorobanAuthorizationEntry.fromXdr(entry.toXdr());
}
