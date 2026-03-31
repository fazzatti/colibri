import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { LocalSigner, NativeAccount } from "@colibri/core";
import { ChannelAccountsPool } from "@/plugin/pool.ts";
import { CHANNEL_NOT_ALLOCATED } from "@/shared/error.ts";
import type { ChannelAccount } from "@/shared/types.ts";

const createChannel = (): ChannelAccount =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

describe("ChannelAccountsPool", () => {
  it("ignores duplicate registrations and reuses an existing allocation", async () => {
    const first = createChannel();
    const second = createChannel();
    const pool = new ChannelAccountsPool([first]);

    pool.registerChannels([first, second]);

    assertEquals(
      pool.getChannels().map((channel) => channel.address()).sort(),
      [first.address(), second.address()].sort(),
    );

    const allocated = await pool.allocate("run-1");
    const allocatedAgain = await pool.allocate("run-1");

    assertStrictEquals(allocatedAgain, allocated);
    assertEquals(pool.hasAllocation("run-1"), true);
  });

  it("waits for a released channel when the pool is exhausted", async () => {
    const channel = createChannel();
    const pool = new ChannelAccountsPool([channel]);

    const allocated = await pool.allocate("run-1");
    const waiter = pool.allocate("run-2");

    pool.release("run-1");

    const reallocated = await waiter;

    assertStrictEquals(allocated, reallocated);
    assertEquals(pool.hasAllocation("run-1"), false);
    assertEquals(pool.hasAllocation("run-2"), true);
    assertEquals(pool.getChannels().map((item) => item.address()), [
      channel.address(),
    ]);
  });

  it("throws when releasing a run without an allocation", () => {
    const pool = new ChannelAccountsPool();

    assertThrows(
      () => {
        pool.release("missing-run");
      },
      CHANNEL_NOT_ALLOCATED,
    );
  });
});
