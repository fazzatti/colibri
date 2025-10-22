import type { Buffer } from "node:buffer";
import type { TransactionSigner } from "../types.ts";

export type LocalSigner = TransactionSigner & {
  verifySignature(data: Buffer, signature: Buffer): boolean;
};
