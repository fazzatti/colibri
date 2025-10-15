import { cereal, xdr } from "stellar-sdk";
import type { Buffer } from "buffer";

// extracted from stellar-sdk
// https://github.com/stellar/js-stellar-sdk/blob/master/src/contract/utils.ts
export function processSpecEntryStream(buffer: Buffer) {
  const reader = new cereal.XdrReader(buffer);
  const res: xdr.ScSpecEntry[] = [];
  while (!reader.eof) {
    // deno-lint-ignore no-explicit-any
    res.push(xdr.ScSpecEntry.read(reader as any));
  }
  return res;
}
