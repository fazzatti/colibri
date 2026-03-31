import type { BinaryData } from "@/common/types/index.ts";
import type { Signer } from "@/signer/types.ts";

/** @internal */
export type LocalSigner = Signer & {
  verifySignature(data: BinaryData, signature: BinaryData): boolean;
};
