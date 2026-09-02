import { xdr } from "stellar-sdk";
import type { BinaryData } from "@/common/types/index.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";

// extracted from stellar-sdk
// https://github.com/stellar/js-stellar-sdk/blob/master/src/contract/utils.ts
export function processSpecEntryStream(buffer: BinaryData) {
  return xdr.decodeStream(xdr.ScSpecEntry, toUint8Array(buffer));
}
