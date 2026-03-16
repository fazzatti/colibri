import type { Buffer } from "buffer";
import type { Signer } from "@/signer/types.ts";

export type LocalSigner = Signer & {
  verifySignature(data: Buffer, signature: Buffer): boolean;
};
