import type { BinaryData } from "@/common/types/index.ts";
import type { KeypairSigner } from "@/signer/types.ts";

/** @internal */
export type LocalSigner = KeypairSigner & {
  verifySignature(data: BinaryData, signature: BinaryData): boolean;
};
