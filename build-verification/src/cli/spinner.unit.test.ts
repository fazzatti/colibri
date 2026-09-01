import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type {
  BuildVerificationStage,
  VerificationLogEvent,
} from "@/core/index.ts";
import {
  createBuildVerificationSpinner,
  formatBuildVerificationSpinnerStatus,
} from "@/cli/spinner.ts";

const event = (stage: BuildVerificationStage): VerificationLogEvent => ({
  timestamp: "2026-09-01T12:00:00.000Z",
  stage,
  level: "info",
  code: "BLDV_PROGRESS",
  message: "Progress recorded.",
});

describe("build-verification CLI spinner", () => {
  it("maps every verification stage to a stable status", () => {
    const stages: readonly BuildVerificationStage[] = [
      "resolve-verification-target",
      "parse-contract-metadata",
      "validate-build-recipe",
      "resolve-source-archive",
      "resolve-build-image",
      "execute-contract-build",
      "select-build-artifact",
      "compare-contract-wasm",
    ];
    assertEquals(
      stages.map((stage) => formatBuildVerificationSpinnerStatus(event(stage))),
      [
        "Verifying contract build · Resolving verification target…",
        "Verifying contract build · Parsing contract metadata…",
        "Verifying contract build · Validating build recipe…",
        "Verifying contract build · Resolving source archive…",
        "Verifying contract build · Resolving build image…",
        "Verifying contract build · Rebuilding contract…",
        "Verifying contract build · Selecting build artifact…",
        "Verifying contract build · Comparing contract Wasm…",
      ],
    );
  });

  it("animates, updates, and clears exactly once", () => {
    const writes: string[] = [];
    let tick: (() => void) | undefined;
    const cleared: number[] = [];
    const spinner = createBuildVerificationSpinner({
      write: (value) => writes.push(value),
      setInterval: (callback, milliseconds) => {
        assertEquals(milliseconds, 80);
        tick = callback;
        return 17;
      },
      clearInterval: (id) => cleared.push(id),
    });

    assertStringIncludes(writes[0], "⠋ Verifying contract build…");
    tick?.();
    assertStringIncludes(writes[1], "⠙ Verifying contract build…");
    spinner.update("Verifying contract build · Rebuilding contract…");
    assertStringIncludes(writes[2], "⠹ Verifying contract build · Rebuilding");

    spinner.stop();
    spinner.stop();
    spinner.update("ignored");
    assertEquals(cleared, [17]);
    assertEquals(writes.at(-1), "\r\x1b[2K");
    assertEquals(writes.length, 4);
  });
});
