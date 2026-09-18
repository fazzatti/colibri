import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { NetworkConfig } from "@colibri/core/network";
import { createColibriConfig } from "@/context/config.ts";
import { ColibriReactError } from "@/errors/index.ts";
import { colibriQueryKey, queryValue } from "@/query/options.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const network = NetworkConfig.TestNet();
describe("query identity and serialization", () => {
  it("keys bigint, bytes, maps, missing fields and sorted objects without collisions", () => {
    assertEquals(queryValue({ b: 2, a: 1 }), queryValue({ a: 1, b: 2 }));
    assertEquals(
      queryValue(new Map([[2n, "b"], [1n, "a"]])),
      queryValue(new Map([[1n, "a"], [2n, "b"]])),
    );
    const keys = [1, 1n, "1", undefined, null, new Uint8Array([1]), [1], {}, {
      a: undefined,
    }].map((x) => JSON.stringify(queryValue(x)));
    assertEquals(new Set(keys).size, keys.length);
    const cycle: unknown[] = [];
    cycle.push(cycle);
    for (const value of [cycle, NaN, () => 0, new Date()]) {
      assertThrows(() => queryValue(value), ColibriReactError);
    }
    assertEquals(queryValue({ toXDR: () => "xdr" }), ["xdr", "xdr"]);
    assertEquals(queryValue({ toXdr: () => "xdr" }), ["xdr", "xdr"]);
  });
  it("isolates networks and RPC namespaces", () => {
    const a = createColibriConfig({ network });
    const b = createColibriConfig({ network: NetworkConfig.MainNet() });
    const c = createColibriConfig({ network, scope: "other" });
    assertEquals(
      new Set(
        [a, b, c].map((x) =>
          JSON.stringify(colibriQueryKey(x, "balance", { address: "G" }))
        ),
      ).size,
      3,
    );
    for (const config of [a, b, c]) config.destroy();
  });
});
