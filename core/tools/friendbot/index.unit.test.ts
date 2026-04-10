import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import * as E from "@/tools/friendbot/error.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";
import { Server } from "stellar-sdk/rpc";

describe("initializeWithFriendbot", () => {
  const TEST_PUBLIC =
    "GAA2CTTAU36PSQZI2QX2FZ2AVJEFSJSOYDQ4CJ35NKSRHXVBTZWYAMSZ" as Ed25519PublicKey;
  const FRIENDBOT_URL = "https://friendbot.stellar.org";

  it("initializes account successfully", async () => {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("OK", { status: 200 })),
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
      "The address provided is invalid!",
    );
  });

  it("throws UNEXPECTED on non-200 response", async () => {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response("Account already exists", { status: 400 }),
        ),
    );

    try {
      await assertRejects(
        () => initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC),
        E.UNEXPECTED,
        "An unexpected error occurred when using Friendbot!",
      );
    } finally {
      fetchStub.restore();
    }
  });

  it("throws UNEXPECTED on network error", async () => {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );

    try {
      await assertRejects(
        () => initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC),
        E.UNEXPECTED,
      );
    } finally {
      fetchStub.restore();
    }
  });

  it("treats an already funded response as success and waits for RPC visibility", async () => {
    const fetchStub = stub(globalThis, "fetch", () =>
      Promise.resolve(
        new Response("account already funded to starting balance", {
          status: 400,
        }),
      ));
    const getAccountStub = stub(
      Server.prototype,
      "getAccount",
      () => Promise.resolve({} as never),
    );

    try {
      const result = await initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC, {
        rpcUrl: "https://rpc.example.com",
      });

      assertEquals(result, undefined);
      assertEquals(getAccountStub.calls.length, 1);
    } finally {
      getAccountStub.restore();
      fetchStub.restore();
    }
  });

  it("retries RPC propagation until the funded account becomes visible", async () => {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("OK", { status: 200 })),
    );
    let attempts = 0;
    const getAccountStub = stub(
      Server.prototype,
      "getAccount",
      () => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(new Error("not visible yet"));
        }

        return Promise.resolve({} as never);
      },
    );

    try {
      const result = await initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC, {
        rpcUrl: "https://rpc.example.com",
        pollIntervalInMs: 0,
      });

      assertEquals(result, undefined);
      assertEquals(attempts, 2);
      assertEquals(getAccountStub.calls.length, 2);
    } finally {
      getAccountStub.restore();
      fetchStub.restore();
    }
  });

  it("throws RPC_PROPAGATION_TIMEOUT when RPC propagation times out", async () => {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("OK", { status: 200 })),
    );
    const propagationError = new Error("not visible yet");
    const getAccountStub = stub(
      Server.prototype,
      "getAccount",
      () => Promise.reject(propagationError),
    );
    const nowValues = [0, 0, 2];
    const dateNowStub = stub(Date, "now", () => nowValues.shift() ?? 2);

    try {
      const error = await assertRejects(
        () =>
          initializeWithFriendbot(FRIENDBOT_URL, TEST_PUBLIC, {
            rpcUrl: "https://rpc.example.com",
            timeoutInMs: 1,
            pollIntervalInMs: 0,
          }),
        E.RPC_PROPAGATION_TIMEOUT,
      );

      assertEquals(
        error.message,
        `Account ${TEST_PUBLIC} was funded but did not become visible on RPC within 1ms.`,
      );
      assertStrictEquals(error.meta.cause, propagationError);
    } finally {
      dateNowStub.restore();
      getAccountStub.restore();
      fetchStub.restore();
    }
  });
});
