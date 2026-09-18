import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { type Browser, chromium } from "npm:playwright@1.61.0";
import { renderReport } from "../../test-tooling/recorder/report/index.ts";
import type { RecorderReport } from "../../test-tooling/recorder/types.ts";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const hash = "a".repeat(64);
function fixture(): RecorderReport {
  return {
    schemaVersion: 1,
    runId: "browser-fixture",
    complete: true,
    exitCode: 0,
    diagnostics: [],
    records: [
      {
        id: "test",
        kind: "test",
        file: "token.test.ts",
        name: "reads a balance",
        path: ["Token", "reads a balance"],
        status: "passed",
        runnerStatus: "passed",
        startedAt: "2026-09-18T12:00:00Z",
      },
      ...[10, 30, 20].map((durationMs, index) => ({
        id: `execution-${index}`,
        kind: "execution" as const,
        file: "token.test.ts",
        testId: "test",
        name: index === 0
          ? "</script><script>globalThis.pwned=true</script>"
          : "read balance",
        status: "passed" as const,
        startedAt: "2026-09-18T12:00:00Z",
        durationMs,
        data: { amount: "10000000" },
        execution: {
          kind: "read" as const,
          client: "token",
          contract: "CDEMO",
          method: "balance",
          network: "Testnet",
          hash,
          chain: "not-submitted" as const,
          operations: ["invokeHostFunction"],
          stages: [],
          simulations: [{
            stage: "simulate-transaction",
            instructions: 1000 + index * 200,
            diskReadBytes: 500,
            writeBytes: 0,
            readOnlyEntries: 2,
            readWriteEntries: 0,
            minResourceFee: "120",
          }],
        },
      })),
    ],
  };
}

describe("standalone HTML evidence report", () => {
  let browser: Browser;
  let directory: string;
  beforeAll(async () => {
    browser = await chromium.launch();
    directory = await Deno.makeTempDir();
  });
  afterAll(async () => {
    await browser.close();
    await Deno.remove(directory, { recursive: true });
  });
  it("works from file URLs, renders hostile strings safely and filters/sorts profiles", async () => {
    const path = join(directory, "report.html");
    await Deno.writeTextFile(path, renderReport(fixture()));
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    try {
      await page.goto(pathToFileURL(path).href);
      assertEquals(await page.locator("#tree button").count(), 4);
      assertEquals(
        await page.evaluate(() => Reflect.get(globalThis, "pwned")),
        undefined,
      );
      await page.locator('[data-record="execution-0"]').click();
      await page.getByRole("button", { name: "Copy hash", exact: true })
        .click();
      await page.locator("#toast").filter({ hasText: "Hash" }).waitFor();
      assertStringIncludes(await page.locator("#toast").innerText(), "Hash");
      await page.getByRole("button", { name: "Profiling", exact: true })
        .click();
      assertEquals(await page.locator("#profile-body tr").count(), 3);
      assertEquals(
        await page.locator("#profile-body tr:first-child td").nth(5)
          .innerText(),
        "30",
      );
      await page.getByRole("button", { name: "Duration (ms)", exact: true })
        .click();
      assertEquals(
        await page.locator("#profile-body tr:first-child td").nth(5)
          .innerText(),
        "10",
      );
      await page.locator("#search").fill("no matches");
      assert(await page.locator("#profile-empty").isVisible());
      await page.locator("#search").fill("CDEMO");
      assertEquals(await page.locator("#profile-body tr").count(), 3);
      await page.locator("#client").selectOption("token");
      await page.locator("#method").selectOption("balance");
      assertStringIncludes(
        await page.locator("#groups").innerText(),
        "Variance",
      );
      assertStringIncludes(await page.locator("#groups").innerText(), "1,200");
      await page.screenshot({
        path: "/private/tmp/colibri-recorder-profiling.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Evidence", exact: true }).click();
      await page.locator('[data-record="execution-1"]').click();
      await page.screenshot({
        path: "/private/tmp/colibri-recorder-evidence.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: "dark" });
      assert(
        await page.getByRole("heading", { name: "read balance", exact: true })
          .isVisible(),
      );
      await page.screenshot({
        path: "/private/tmp/colibri-recorder-mobile.png",
        fullPage: true,
      });
      assertEquals(errors, []);
      assertEquals(requests, [pathToFileURL(path).href]);
    } finally {
      await page.close();
    }
  });
  it("browses thousands of records without hiding duplicate file basenames", async () => {
    const report = fixture();
    report.records = Array.from({ length: 3000 }, (_, index) => ({
      ...report.records[0],
      id: `test-${index}`,
      name: `test ${index}`,
      file: `file:///checkout/colibri/package-${
        Math.floor(index / 100)
      }/index.unit.test.ts`,
    }));
    const path = join(directory, "large.html");
    await Deno.writeTextFile(path, renderReport(report));
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(pathToFileURL(path).href);
      assertEquals(await page.locator("#tree > details").count(), 30);
      assertStringIncludes(
        await page.locator("#tree > details > summary").first().innerText(),
        "package-0/index.unit.test.ts",
      );
      assertEquals(await page.locator("#tree > details[open]").count(), 0);
      await page.getByText("package-29/index.unit.test.ts (100)", {
        exact: true,
      }).click();
      await page.locator('[data-record="test-2999"]').click();
      assertStringIncludes(
        await page.locator("#detail").innerText(),
        "test 2999",
      );
      await page.locator("#search").fill("test 1999");
      assertEquals(await page.locator("#tree button").count(), 1);
      assertEquals(errors, []);
    } finally {
      await page.close();
    }
  });
  it("handles empty and incomplete artifacts", async () => {
    const report = fixture();
    report.records = [];
    report.complete = false;
    report.diagnostics = ["Interrupted run"];
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(report));
      assertStringIncludes(
        await page.locator("#tree").innerText(),
        "No matching evidence",
      );
      assertStringIncludes(
        await page.locator("#run").innerText(),
        "Incomplete",
      );
      assertStringIncludes(
        await page.locator("#warnings").innerText(),
        "Interrupted",
      );
    } finally {
      await page.close();
    }
  });
});
