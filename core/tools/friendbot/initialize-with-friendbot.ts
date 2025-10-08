import { assert } from "../../common/assert/assert.ts";
import type { Ed25519PublicKey } from "../../common/types.ts";
import { isEd25519PublicKey } from "../../common/verifiers/index.ts";
import * as E from "./error.ts";
export const initializeWithFriendbot = async (
  friendbotUrl: string,
  publicKey: Ed25519PublicKey
): Promise<void> => {
  assert(
    isEd25519PublicKey(publicKey),
    new E.INVALID_ADDRESS(friendbotUrl, publicKey)
  );

  try {
    const response = await fetch(
      `${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
    );

    const text = await response.text(); // Deno: Consume the response body to prevent resource leaks

    if (response.status !== 200) {
      throw new E.UNEXPECTED(
        friendbotUrl,
        new Error(`Failed to initialize with Friendbot: ${text}`)
      );
    }

    return;
  } catch (e) {
    throw new E.UNEXPECTED(friendbotUrl, e as Error);
  }
};
