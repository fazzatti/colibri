import { Buffer } from "buffer";
import type { XdrSerializable } from "@/common/types/index.ts";

const BASE64_REGEX =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function decodeByteFormBase64(value: Uint8Array): string | null {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(value);
    if (
      BASE64_REGEX.test(decoded) &&
      Buffer.from(decoded, "base64").toString("base64") === decoded
    ) {
      return decoded;
    }
  } catch {
    // Fall through and treat the payload as raw bytes.
  }

  return null;
}

export function toBase64Xdr(value: XdrSerializable): string {
  const encoded = value.toXDR("base64");
  if (typeof encoded === "string") {
    return encoded;
  }

  const byteFormBase64 = decodeByteFormBase64(encoded);
  return byteFormBase64 ?? Buffer.from(encoded).toString("base64");
}

export function toRawXdrBuffer(value: XdrSerializable): Buffer {
  const encoded = value.toXDR("base64");
  if (typeof encoded === "string") {
    return Buffer.from(encoded, "base64");
  }

  const byteFormBase64 = decodeByteFormBase64(encoded);
  return byteFormBase64
    ? Buffer.from(byteFormBase64, "base64")
    : Buffer.from(encoded);
}
