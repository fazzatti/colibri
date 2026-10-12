import { assertEquals, assertStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { LocalSigner, NativeAccount } from "@colibri/core";
import { ChannelAccountsAdmission } from "@/plugin/admission.ts";
import { ChannelAccountsPool } from "@/plugin/pool.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("Channel admission ownership", () => {
  it("reuses the same run's pending and active lease without consuming another permit", async () => {
    const account = NativeAccount.fromMasterSigner(
      LocalSigner.generateRandom(),
    );
    const pool = new ChannelAccountsPool();
    const admission = new ChannelAccountsAdmission(pool, {
      concurrency: 1,
      maxPending: 1,
    });
    const first = admission.acquire("same-run");
    assertStrictEquals(admission.acquire("same-run"), first);
    pool.registerChannels([account]);
    assertStrictEquals(await first, account);
    assertStrictEquals(await admission.acquire("same-run"), account);
    await admission.release("same-run");
    assertEquals(pool.hasAllocation("same-run"), false);
    assertEquals(admission.release("same-run"), undefined);
    assertStrictEquals(await admission.acquire("next-run"), account);
    await admission.release("next-run");
  });
});
