import type { Buffer } from "buffer";
import type { TransactionSigner } from "@/signer/types.ts";

export type LocalSigner = TransactionSigner & {
  verifySignature(data: Buffer, signature: Buffer): boolean;
};
