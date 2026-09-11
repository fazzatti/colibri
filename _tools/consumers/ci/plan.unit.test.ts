import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { compatibilityChecks, sdkTargets, verifyRuntime } from "./plan.ts";

const sameSdk = [
  { selection: "17.0.1", version: "17.0.1" },
  { selection: "^17.0.1", version: "17.0.1" },
];

describe("consolidated compatibility plan", () => {
  it("deduplicates identical resolutions without losing runtime or compiler combinations", () => {
    const checks = compatibilityChecks(sameSdk, "/tmp/compatibility");
    assertEquals(sdkTargets(sameSdk), ["17.0.1"]);
    assertEquals(checks.length, 16);
    assertEquals(new Set(checks.map((check) => check.id)).size, checks.length);
    assertEquals(
      checks.filter((check) => check.phase.startsWith("node-")).map((
        check,
      ) => [check.node, check.env.TYPESCRIPT_VERSION]),
      [
        ["22.12.0", "5.9.3"],
        ["22.12.0", "6.0.3"],
        ["22", "5.9.3"],
        ["22", "6.0.3"],
        ["24", "5.9.3"],
        ["24", "6.0.3"],
      ],
    );
    assertEquals(
      checks.filter((check) => check.phase.startsWith("deno-")).map((check) =>
        check.deno
      ),
      ["2.7.11", "2.9.6"],
    );
    assertEquals(
      checks.filter((check) => check.phase === "browsers").length,
      1,
    );
    assertEquals(
      checks.filter((check) => check.phase === "dependencies").length,
      1,
    );
    assertEquals(checks.filter((check) => check.phase === "prepare").length, 1);
    assertEquals(
      checks.filter((check) => check.phase === "jsr-declarations").map((
        check,
      ) => check.env.TYPESCRIPT_VERSION),
      ["5.9.3", "6.0.3"],
    );
  });
  it("keeps the complete second matrix when the compatible SDK resolves newer", () => {
    const checks = compatibilityChecks([sameSdk[0], {
      selection: "^17.0.1",
      version: "17.1.0",
    }], "/tmp/compatibility");
    assertEquals(checks.length, 29);
    for (const sdk of ["17.0.1", "17.1.0"]) {
      assertEquals(
        checks.filter((check) =>
          check.phase.startsWith("node-") &&
          check.env.STELLAR_SDK_VERSION === sdk
        ).length,
        6,
      );
      assertEquals(
        checks.filter((check) =>
          check.phase.startsWith("deno-") &&
          check.env.STELLAR_SDK_VERSION === sdk
        ).length,
        2,
      );
      assertEquals(
        checks.filter((check) =>
          check.phase === "browsers" && check.env.STELLAR_SDK_VERSION === sdk
        ).length,
        1,
      );
      assertEquals(
        checks.filter((check) =>
          check.phase === "dependencies" &&
          check.env.STELLAR_SDK_VERSION === sdk
        ).length,
        1,
      );
    }
    const budget = checks.find((check) => check.id === "bundles-17.0.1")!;
    assertEquals(budget.args.slice(-2), [
      "/tmp/compatibility/bundles",
      "/tmp/compatibility/sdk-17.0.1",
    ]);
    assertEquals(
      checks.filter((check) => check.phase === "browser-runner").length,
      1,
    );
  });
  it("rejects incomplete, duplicated or unsupported SDK resolution evidence", () => {
    for (
      const resolutions of [
        [],
        [sameSdk[0]],
        [sameSdk[0], sameSdk[0]],
        [sameSdk[0], { selection: "^17.0.1", version: "18.0.0" }],
        [sameSdk[0], { selection: "^17.0.1", version: "17.0.0" }],
        [{ selection: "17.0.1", version: "17.1.0" }, sameSdk[1]],
      ]
    ) {
      assertThrows(
        () => sdkTargets(resolutions),
        Error,
        "Invalid SDK resolution plan",
      );
    }
  });
  it("verifies the actual runtime instead of trusting phase labels", () => {
    const checks = compatibilityChecks(sameSdk, "/tmp/compatibility");
    const minimum = checks.filter((check) => check.phase === "node-22.12.0");
    verifyRuntime(minimum, "2.9.6", "22.12.0");
    assertThrows(
      () => verifyRuntime(minimum, "2.9.6", "22.13.0"),
      Error,
      "Runtime mismatch",
    );
    assertThrows(
      () => verifyRuntime(minimum, "2.9.6"),
      Error,
      "Runtime mismatch",
    );
    verifyRuntime(
      checks.filter((check) => check.phase === "node-22"),
      "2.9.6",
      "22.13.0",
    );
    assertThrows(
      () =>
        verifyRuntime(
          checks.filter((check) => check.phase === "node-22"),
          "2.9.6",
          "24.0.0",
        ),
      Error,
      "Runtime mismatch",
    );
    const deno = checks.filter((check) => check.phase === "deno-2.7.11");
    verifyRuntime(deno, "2.7.11");
    assertThrows(() => verifyRuntime(deno, "2.9.6"), Error, "Runtime mismatch");
  });
});
