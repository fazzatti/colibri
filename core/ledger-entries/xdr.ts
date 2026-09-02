import type { XdrSerializable } from "@/common/types/index.ts";

export function toBase64Xdr(value: XdrSerializable): string {
  return value.toXdr("base64");
}

export function toRawXdrBytes(value: XdrSerializable): Uint8Array {
  return value.toXdr();
}
