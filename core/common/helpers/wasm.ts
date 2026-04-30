import { cereal, xdr } from "stellar-sdk";
import type { BinaryData } from "@/common/types/index.ts";
import { toBuffer } from "@/common/helpers/internal-buffer.ts";

// extracted from stellar-sdk
// https://github.com/stellar/js-stellar-sdk/blob/master/src/contract/utils.ts
export function processSpecEntryStream(buffer: BinaryData) {
  const reader = new cereal.XdrReader(toBuffer(buffer));
  const res: xdr.ScSpecEntry[] = [];
  while (!reader.eof) {
    // deno-lint-ignore no-explicit-any
    res.push(xdr.ScSpecEntry.read(reader as any));
  }
  return res;
}
