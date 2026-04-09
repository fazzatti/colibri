import { assert } from "@/common/assert/assert.ts";
import { StrKey } from "@/strkeys/index.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import * as E from "@/tools/friendbot/error.ts";
import { Server } from "stellar-sdk/rpc";

/** Optional behavior overrides for Friendbot initialization. */
export type InitializeWithFriendbotOptions = {
  rpcUrl?: string;
  allowHttp?: boolean;
  timeoutInMs?: number;
  pollIntervalInMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForRpcPropagation = async (
  friendbotUrl: string,
  publicKey: Ed25519PublicKey,
  options?: InitializeWithFriendbotOptions,
) => {
  if (!options?.rpcUrl) return;

  const rpc = new Server(options.rpcUrl, {
    allowHttp: options.allowHttp ?? false,
  });
  const startedAt = Date.now();
  const timeoutInMs = options.timeoutInMs ?? 15_000;
  const pollIntervalInMs = options.pollIntervalInMs ?? 1_000;

  while (Date.now() - startedAt < timeoutInMs) {
    try {
      await rpc.getAccount(publicKey);
      return;
    } catch {
      await sleep(pollIntervalInMs);
    }
  }

  throw new E.RPC_PROPAGATION_TIMEOUT(
    friendbotUrl,
    publicKey,
    options.rpcUrl,
    timeoutInMs,
  );
};

/** Funds an account with Friendbot and optionally waits for RPC visibility. */
export const initializeWithFriendbot = async (
  friendbotUrl: string,
  publicKey: Ed25519PublicKey,
  options?: InitializeWithFriendbotOptions,
): Promise<void> => {
  assert(
    StrKey.isEd25519PublicKey(publicKey),
    new E.INVALID_ADDRESS(friendbotUrl, publicKey)
  );

  try {
    const response = await fetch(
      `${friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
    );

    const text = await response.text(); // Deno: Consume the response body to prevent resource leaks

    const alreadyFunded =
      response.status === 400 &&
      text.includes("account already funded to starting balance");

    if (response.status !== 200 && !alreadyFunded) {
      throw new E.UNEXPECTED(
        friendbotUrl,
        new Error(`Failed to initialize with Friendbot: ${text}`)
      );
    }

    await waitForRpcPropagation(friendbotUrl, publicKey, options);

    return;
  } catch (e) {
    if (e instanceof E.FriendbotError) {
      throw e;
    }
    throw new E.UNEXPECTED(friendbotUrl, e as Error);
  }
};
