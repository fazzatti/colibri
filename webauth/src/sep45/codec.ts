import { Buffer } from "buffer";
import { xdr } from "stellar-sdk";
import { Sep45Code, Sep45Error } from "@/error.ts";

function encodeEntries(
  entries: xdr.SorobanAuthorizationEntry[],
): Buffer {
  // `SorobanAuthorizationEntries` is a generated variable-array instance.
  // js-xdr 4 exposes array encoding through the static XdrType implementation,
  // while its generated TypeScript declaration still presents it as an
  // instance method. Borrowing the static encoder keeps this exact and avoids
  // manually reimplementing XDR framing.
  const encode = xdr.SorobanAuthorizationEntry.toXDR as unknown as (
    this: typeof xdr.SorobanAuthorizationEntries,
    value: xdr.SorobanAuthorizationEntry[],
  ) => Buffer;
  return encode.call(xdr.SorobanAuthorizationEntries, entries);
}

/** Decodes an exact variable-length Soroban authorization-entry array. */
export function decodeSep45AuthorizationEntries(
  value: string,
): xdr.SorobanAuthorizationEntry[] {
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
    const bytes = Buffer.from(value, "base64");
    const entries = xdr.SorobanAuthorizationEntries.fromXDR(bytes);
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
  entries: xdr.SorobanAuthorizationEntry[],
): string {
  return encodeEntries(entries).toString("base64");
}

/** Deep-clones an authorization entry through XDR. */
export function cloneSep45AuthorizationEntry(
  entry: xdr.SorobanAuthorizationEntry,
): xdr.SorobanAuthorizationEntry {
  return xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
}
