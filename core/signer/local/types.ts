import type { BinaryData } from "@/common/types/index.ts";
import type { KeypairSigner, MessageSigner } from "@/signer/types.ts";

/** @internal */
export type LocalSigner = KeypairSigner & MessageSigner & {
  verifySignature(data: BinaryData, signature: BinaryData): boolean;
};
