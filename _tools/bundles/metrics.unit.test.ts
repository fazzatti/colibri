import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { assertStandalone, checkMeasurement, measure } from "./metrics.ts";
import { forbiddenDependencies } from "./fixtures.ts";

describe("production bundle guards", () => {
  it("rejects vendor runtimes without rejecting Colibri's ecosystem adapter", () => {
    const forbidden = forbiddenDependencies("react-wallets-kit");
    for (
      const source of [
        "node_modules/@creit.tech/stellar-wallets-kit/esm/sdk.js",
        "npm:@stellar/freighter-api@6.0.1/index.js",
        "node_modules/.deno/preact@10.24.2/node_modules/preact/dist/preact.js",
        "node_modules/@preact/signals/dist/signals.js",
        "node_modules/@twind/core/core.js",
      ]
    ) {
      assertEquals(forbidden.some((pattern) => pattern.test(source)), true);
    }
    assertEquals(
      forbidden.some((pattern) =>
        pattern.test(
          "node_modules/@colibri/react/esm/src/ecosystem/stellar-wallets-kit/connector.js",
        )
      ),
      false,
    );
  });
  it("rejects remaining module imports without mistaking text for code", () => {
    for (
      const code of [
        'import "external";',
        'export * from "external";',
        'const load = () => import("external");',
      ]
    ) {
      assertThrows(
        () => assertStandalone(code),
        Error,
        "BUNDLE_EXTERNAL_IMPORT",
      );
    }
    assertStandalone('export const example = "import(\\"external\\")";');
  });
  it("separates visited sources from mapped code", () => {
    const result = measure(
      new TextEncoder().encode("export const a=1;"),
      JSON.stringify({
        version: 3,
        sources: ["errors.ts", "fast-png/index.js"],
        names: [],
        mappings: "AAAA",
      }),
    );
    assertEquals(result.visited.length, 2);
    assertEquals(result.retained, ["errors.ts"]);
    checkMeasurement("errors", result);
    assertThrows(
      () =>
        checkMeasurement("svg", {
          ...result,
          retained: ["node_modules/fast-png/index.js"],
        }),
      Error,
      "BUNDLE_DEPENDENCIES",
    );
    assertThrows(
      () => checkMeasurement("errors", { ...result, raw: 2001 }),
      Error,
      "BUNDLE_BUDGET",
    );
    assertThrows(
      () => checkMeasurement("errors", { ...result, gzip: 1001 }),
      Error,
      "BUNDLE_BUDGET",
    );
  });
});
