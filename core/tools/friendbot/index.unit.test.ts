import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { initializeWithFriendbot } from "./initialize-with-friendbot.ts";
import * as E from "./error.ts";
import type { Ed25519PublicKey } from "../../strkeys/types.ts";

describe("initializeWithFriendbot", () => {
  const TEST_PUBLIC =
    "GAA2CTTAU36PSQZI2QX2FZ2AVJEFSJSOYDQ4CJ35NKSRHXVBTZWYAMSZ" as Ed25519PublicKey;
  const FRIENDBOT_URL = "https://friendbot.stellar.org";

  it("initializes account successfully", async () => {
    const fetchStub = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response("OK", { status: 200 }))
    );

    try {
      const result = await initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC);
      assertEquals(result, undefined);
    } finally {
      fetchStub.restore();
    }
  });

  it("throws INVALID_ADDRESS for invalid public key", async () => {
    const invalidAddress = "INVALID_ADDRESS" as Ed25519PublicKey;

    await assertRejects(
      () => initializeWithFriendbot(FRIENDBOT_URL, invalidAddress),
      E.INVALID_ADDRESS,
      "The address provided is invalid!"
    );
  });

  it("throws UNEXPECTED on non-200 response", async () => {
    const fetchStub = stub(globalThis, "fetch", () =>
      Promise.resolve(new Response("Account already exists", { status: 400 }))
    );

    try {
      await assertRejects(
        () => initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC),
        E.UNEXPECTED,
        "An unexpected error occurred when using Friendbot!"
      );
    } finally {
      fetchStub.restore();
    }
  });

  it("throws UNEXPECTED on network error", async () => {
    const fetchStub = stub(globalThis, "fetch", () =>
      Promise.reject(new Error("Network error"))
    );

    try {
      await assertRejects(
        () => initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC),
        E.UNEXPECTED
      );
    } finally {
      fetchStub.restore();
    }
  });
});
