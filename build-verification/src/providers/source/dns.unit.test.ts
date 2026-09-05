import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { collectSourceDnsAddresses } from "@/providers/source/dns.ts";
import {
  SourceDnsEmptyError,
  SourceDnsResolutionFailedError,
} from "@/providers/source/error.ts";
import { DenoSourceAddressResolver } from "@/providers/source/http.ts";
import { Code } from "@/error/base.ts";

describe("source DNS outcome classification", () => {
  it("deduplicates successful address families in lookup order", () => {
    assertEquals(
      collectSourceDnsAddresses("example.com", [
        { status: "fulfilled", value: ["192.0.2.1", "192.0.2.1"] },
        { status: "fulfilled", value: ["2001:db8::1"] },
      ]),
      ["192.0.2.1", "2001:db8::1"],
    );
  });

  it("keeps either successful family when the other fails or is empty", () => {
    const absentFamily = new Deno.errors.NotFound("No record for this family");
    for (const address of ["192.0.2.1", "2001:db8::1"]) {
      const success: PromiseFulfilledResult<readonly string[]> = {
        status: "fulfilled",
        value: [address],
      };
      const alternatives: PromiseSettledResult<readonly string[]>[] = [
        { status: "fulfilled", value: [] },
        { status: "rejected", reason: absentFamily },
      ];
      for (const other of alternatives) {
        assertEquals(
          collectSourceDnsAddresses("example.com", [success, other]),
          [address],
        );
        assertEquals(
          collectSourceDnsAddresses("example.com", [other, success]),
          [address],
        );
      }
    }
  });

  it("preserves every rejection cause when both lookups fail", () => {
    const ipv4 = new Deno.errors.NotCapable("IPv4 lookup not permitted");
    const ipv6 = new Deno.errors.TimedOut("IPv6 resolver timed out");
    const error = assertThrows(
      () =>
        collectSourceDnsAddresses("example.com", [
          { status: "rejected", reason: ipv4 },
          { status: "rejected", reason: ipv6 },
        ]),
      SourceDnsResolutionFailedError,
    );
    assertEquals(error.code, Code.SOURCE_DNS_RESOLUTION_FAILED);
    assertEquals(error.meta?.data, { hostname: "example.com" });
    const cause = error.meta?.cause;
    assertInstanceOf(cause, AggregateError);
    assertEquals(cause.errors.length, 2);
    assertStrictEquals(cause.errors[0], ipv4);
    assertStrictEquals(cause.errors[1], ipv6);
  });

  it("does not hide one failed lookup behind a successful empty lookup", () => {
    for (const reason of [new Error("resolver unavailable"), undefined]) {
      const failed: PromiseRejectedResult = { status: "rejected", reason };
      const empty: PromiseFulfilledResult<readonly string[]> = {
        status: "fulfilled",
        value: [],
      };
      for (const outcomes of [[failed, empty], [empty, failed]]) {
        const error = assertThrows(
          () => collectSourceDnsAddresses("example.com", outcomes),
          SourceDnsResolutionFailedError,
        );
        const cause = error.meta?.cause;
        assertInstanceOf(cause, AggregateError);
        assertEquals(cause.errors.length, 1);
        assertStrictEquals(cause.errors[0], reason);
      }
    }
  });

  it("reserves the empty-answer error for successful empty lookups", () => {
    const error = assertThrows(
      () =>
        collectSourceDnsAddresses("example.com", [
          { status: "fulfilled", value: [] },
          { status: "fulfilled", value: [] },
        ]),
      SourceDnsEmptyError,
    );
    assertEquals(error.code, Code.SOURCE_DNS_EMPTY);
    assertEquals(error.meta?.data, { hostname: "example.com" });
    assertEquals(error.meta?.cause, undefined);
  });
});

describe({
  name: "source DNS permission boundary",
  permissions: { net: false },
}, () => {
  it("retains real native permission failures without mocking DNS", async () => {
    const error = await assertRejects(
      () => new DenoSourceAddressResolver().resolve("example.com"),
      SourceDnsResolutionFailedError,
    );
    const cause = error.meta?.cause;
    assertInstanceOf(cause, AggregateError);
    assertEquals(cause.errors.length, 2);
    for (const failure of cause.errors) {
      assertInstanceOf(failure, Deno.errors.NotCapable);
    }
  });
});
