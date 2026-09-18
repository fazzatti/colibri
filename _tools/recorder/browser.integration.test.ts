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
  it("opens on Summary and follows file, test and execution evidence offline", async () => {
    const report = fixture();
    const path = join(directory, "report.html");
    await Deno.writeTextFile(path, renderReport(report));
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors: string[] = [], requests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    try {
      await page.goto(pathToFileURL(path).href);
      assertEquals(
        await page.locator("#summary-tab").getAttribute("aria-pressed"),
        "true",
      );
      assert(await page.locator("#summary-view").isVisible());
      await page.locator("#file-body").getByRole("button", {
        name: "token.test.ts",
        exact: true,
      }).click();
      assert(await page.locator("#evidence").isVisible());
      await page.locator('#detail [data-record="test"]').click();
      await page.locator('#detail [data-record="execution-0"]').click();
      assertEquals(
        await page.evaluate(() => Reflect.get(globalThis, "pwned")),
        undefined,
      );
      await page.evaluate(
        `Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { globalThis.copiedHash = value; } } });`,
      );
      await page.getByRole("button", { name: "Copy hash", exact: true })
        .click();
      await page.getByRole("button", { name: "Copied", exact: true }).waitFor();
      assertEquals(
        await page.evaluate(() => Reflect.get(globalThis, "copiedHash")),
        hash,
      );
      assertEquals(await page.locator("#toast").count(), 0);
      assertStringIncludes(
        await page.locator(".hash .copy-feedback").innerText(),
        "Hash copied",
      );
      await page.getByRole("button", { name: "Copy hash", exact: true })
        .waitFor();
      assertEquals(await page.locator(".copy-feedback").innerText(), "");
      const deepLink = page.url();
      await page.reload();
      assertEquals(page.url(), deepLink);
      assertStringIncludes(
        await page.locator("#detail h2").innerText(),
        "</script>",
      );
      await page.locator("#profiling-tab").click();
      assertEquals(
        await page.locator("#profile-mode").inputValue(),
        "executions",
      );
      assertEquals(await page.locator("#profile-body tr").count(), 3);
      assertEquals(
        await page.locator(
          '#profile-body tr:first-child [data-metric="duration"]',
        ).innerText(),
        "30",
      );
      assertEquals(await page.locator("#metric-set").count(), 0);
      for (
        const title of [
          "Instructions (budget)",
          "Read-only entries",
          "Read-write entries",
          "Disk read (bytes)",
          "Write (bytes)",
          "Minimum resource fee (stroops)",
          "Confirmed fee charged (stroops)",
        ]
      ) {
        assertEquals(
          await page.getByRole("button", { name: title, exact: true }).count(),
          1,
        );
      }
      await page.getByRole("button", { name: "Duration (ms)", exact: true })
        .click();
      assertEquals(
        await page.locator(
          '#profile-body tr:first-child [data-metric="duration"]',
        ).innerText(),
        "10",
      );
      await page.locator("#profile-mode").selectOption("groups");
      assertEquals(await page.locator("#group-body tr").count(), 1);
      await page.locator("#group-body button[data-group]").click();
      assertStringIncludes(
        await page.locator("#profile-content").innerText(),
        "3 recorded calls",
      );
      assertStringIncludes(
        await page.locator("#profile-content").innerText(),
        "Standard deviation",
      );
      assertStringIncludes(
        await page.locator("#profile-content").innerText(),
        "1,200",
      );
      await page.locator("#profile-mode").selectOption("executions");
      await page.locator("#search").fill("no matches");
      assert(await page.locator("#profile-empty").isVisible());
      await page.locator("#search").fill("CDEMO");
      await page.locator("#advanced-filters > summary").click();
      await page.locator("#client").selectOption("token");
      await page.locator("#method").selectOption("balance");
      assertEquals(await page.locator("#profile-body tr").count(), 3);
      await page.locator('#profile-body [data-record="execution-1"]').click();
      assertStringIncludes(
        await page.locator("#breadcrumbs").innerText(),
        "reads a balance",
      );
      await page.goBack();
      assert(await page.locator("#profiles").isVisible());
      assertEquals(await page.locator("#search").inputValue(), "CDEMO");
      await page.goForward();
      assertEquals(
        await page.locator("#detail h2").innerText(),
        "read balance",
      );
      await page.goBack();
      assert(await page.locator("#profiles").isVisible());
      await page.screenshot({
        path: "/private/tmp/colibri-recorder-profiling.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.locator("#evidence-tab").click();
      assert(
        await page.getByRole("heading", {
          name: report.records[1].name,
          exact: true,
        })
          .isVisible(),
      );
      assert(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth",
        ),
      );
      await page.screenshot({
        path: "/private/tmp/colibri-recorder-mobile.png",
        fullPage: true,
      });
      assertEquals(errors, []);
      assertEquals(requests.filter((r) => !r.startsWith("file:")), []);
    } finally {
      await page.close();
    }
  });
  it("reaches records beyond 200, restores pagination and browses duplicate file basenames", async () => {
    const report = fixture();
    report.records = Array.from({ length: 3000 }, (_, index) => ({
      ...report.records[0],
      id: `test-${index}`,
      name: `test ${index}`,
      file: `file:///checkout/colibri/package-${
        Math.floor(index / 300)
      }/index.unit.test.ts`,
    }));
    const path = join(directory, "large.html");
    await Deno.writeTextFile(path, renderReport(report));
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(pathToFileURL(path).href);
      assertEquals(await page.locator("#file-body tr").count(), 10);
      await page.getByRole("button", { name: "Expand package-9", exact: true })
        .click();
      await page.locator(
        '#file-body button[title="package-9/index.unit.test.ts"]',
      ).click();
      for (let i = 0; i < 5; i++) {
        await page.getByRole("button", { name: "Next page", exact: true })
          .click();
      }
      await page.locator('[data-record="test-2999"]').click();
      assertStringIncludes(
        await page.locator("#detail").innerText(),
        "test 2999",
      );
      await page.goBack();
      assert(await page.locator('[data-record="test-2999"]').isVisible());
      await page.locator("#clear-context").click();
      await page.locator("#search").fill("test 1999");
      await page.locator(
        '#file-body button[title="package-6/index.unit.test.ts"]',
      ).click();
      assertEquals(
        await page.locator("#detail button[data-record]").count(),
        1,
      );
      await page.locator('[data-record="test-1999"]').focus();
      await page.keyboard.press("Enter");
      assertStringIncludes(
        await page.locator("#detail h2").innerText(),
        "test 1999",
      );
      assertEquals(errors, []);
    } finally {
      await page.close();
    }
  });
  it("separates group files, operation sequences, outcomes and unknown identities", async () => {
    const report = fixture();
    const original = report.records[1];
    const variant = (
      id: string,
      change: Partial<typeof original>,
      execution: object = {},
    ) => ({
      ...original,
      ...change,
      id,
      execution: { ...original.execution!, ...execution },
    });
    report.records.push(
      { ...report.records[0], id: "other-test", file: "other.test.ts" },
      variant("other-file", { file: "other.test.ts", testId: "other-test" }),
      variant("failed", { status: "failed" }),
      variant("chain-failed", {}, { chain: "confirmed-failed" }),
      variant("unknown-1", {}, { network: undefined }),
      variant("unknown-2", {}, { network: undefined }),
      variant("unknown-contract-1", {}, { contract: undefined }),
      variant("unknown-contract-2", {}, { contract: undefined }),
      variant("classic-1", {}, {
        kind: "classic",
        method: undefined,
        operations: ["payment"],
      }),
      variant("classic-2", {}, {
        kind: "classic",
        method: undefined,
        operations: ["manageData"],
      }),
    );
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(report));
      await page.locator("#profiling-tab").click();
      await page.locator("#profile-mode").selectOption("groups");
      assertEquals(await page.locator("#group-body tr").count(), 10);
      await page.locator("#cross-files").check();
      assertEquals(await page.locator("#group-body tr").count(), 9);
      await page.locator("#advanced-filters > summary").click();
      await page.locator("#test-status").selectOption("passed");
      await page.locator("#outcome").selectOption("failed");
      assertEquals(await page.locator("#group-body tr").count(), 1);
      await page.locator("#summary-tab").click();
      assertStringIncludes(
        await page.locator("#summary-view .metrics").innerText(),
        "1",
      );
      await page.locator("#clear-filters").click();
      await page.locator("#profiling-tab").click();
      await page.locator("#chain").selectOption("confirmed-failed");
      assertEquals(await page.locator("#group-body tr").count(), 1);
    } finally {
      await page.close();
    }
  });
  it("keeps shared hooks under their suite and relates nested observations to their test", async () => {
    const report = fixture();
    const test = report.records[0];
    test.parentId = "suite";
    report.records.push({
      ...test,
      id: "suite",
      kind: "suite",
      parentId: undefined,
      name: "Token suite",
    }, {
      ...test,
      id: "hook",
      kind: "hook",
      parentId: "suite",
      name: "beforeAll",
    }, {
      ...test,
      id: "hook-log",
      kind: "log",
      parentId: undefined,
      testId: "hook",
      name: "setup evidence",
    });
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(report));
      await page.locator('#file-body button[title="token.test.ts"]').click();
      await page.locator("#test-body tr").filter({
        has: page.locator('[data-suite="suite"]'),
      }).locator("td").nth(2).click();
      assertEquals(
        await page.locator("#detail h2").innerText(),
        "token.test.ts",
      );
      assertEquals(
        await page.locator('#detail [data-suite="suite"]').getAttribute(
          "aria-expanded",
        ),
        "true",
      );
      assertEquals(
        await page.locator('#detail [data-record="hook"]').count(),
        1,
      );
      await page.locator('#detail [data-record="hook"]').click();
      await page.locator('#detail [data-record="hook-log"]').click();
      assertStringIncludes(
        await page.locator("#breadcrumbs").innerText(),
        "beforeAll",
      );
      assertStringIncludes(
        await page.locator("#detail").innerText(),
        "setup evidence",
      );
    } finally {
      await page.close();
    }
  });
  it("keeps missing measurements absent and fee ordering exact", async () => {
    const report = fixture();
    report.records[1].durationMs = undefined;
    report.records[1].execution!.simulations = [];
    report.records[2].execution!.simulations[0].minResourceFee =
      "9007199254740993";
    report.records[3].execution!.simulations[0].minResourceFee =
      "9007199254740992";
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(report));
      await page.locator("#profiling-tab").click();
      await page.locator("#profile-mode").selectOption("groups");
      await page.locator("#group-body button[data-group]").click();
      const instructions = page.locator("#profile-content tr").filter({
        has: page.getByRole("cell", {
          name: "Instructions (budget)",
          exact: true,
        }),
      }).first();
      assertStringIncludes(await instructions.innerText(), "2 / 3");
      await page.locator("#profile-mode").selectOption("executions");
      await page.getByRole("button", {
        name: "Minimum resource fee (stroops)",
        exact: true,
      }).click();
      assertEquals(
        await page.locator('#profile-body tr:first-child [data-metric="fee"]')
          .innerText(),
        "9007199254740993",
      );
      assertEquals(
        await page.locator('#profile-body tr:last-child [data-metric="fee"]')
          .innerText(),
        "—",
      );
      assertEquals(
        await page.locator(
          '#profile-body tr:first-child [data-metric="charged"]',
        )
          .innerText(),
        "—",
      );
    } finally {
      await page.close();
    }
  });
  it("expands whole folder and suite rows without duplicate view links or directory pages", async () => {
    const report = fixture();
    for (const r of report.records) {
      r.file = "file:///repo/core/contract/read/index.test.ts";
    }
    report.records.push({
      ...report.records[0],
      id: "other",
      file: "file:///repo/react/wallet/index.test.ts",
    });
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(report));
      const context = page.locator("#file-body tr").filter({
        has: page.getByRole("button", {
          name: "Expand core/contract/read",
          exact: true,
        }),
      });
      // Clicking a count cell must perform the same expansion as clicking the name.
      await context.locator("td").nth(1).click();
      assertEquals(
        await page.locator("#summary-view h2").innerText(),
        "All contexts",
      );
      await page.locator(
        '#file-body [data-file="file:///repo/core/contract/read/index.test.ts"]',
      ).click();
      assertEquals(
        await page.locator('#tree [aria-current="page"]').count(),
        1,
      );
      assertEquals(
        await page.locator("#tree button").filter({ hasText: /^View / })
          .count(),
        0,
      );
      const selected = page.locator('#tree [aria-current="page"]');
      assert(
        await selected.evaluate((node) => {
          const style = Reflect.get(globalThis, "getComputedStyle")(node);
          return style.borderLeftWidth === "3px" &&
            style.backgroundColor !== "rgba(0, 0, 0, 0)";
        }),
      );
      const before = await page.locator("#detail").innerText();
      const folder = page.locator('#tree [data-folder="core/contract/read"]');
      await folder.click();
      assertEquals(await folder.getAttribute("aria-expanded"), "false");
      assertEquals(await page.locator("#detail").innerText(), before);
      await page.locator("#clear-context").click();
      assertEquals(await page.locator("#detail [aria-expanded]").count(), 0);
      assertEquals(await page.locator("#file-body tr").count(), 2);
      assertStringIncludes(
        await page.locator("#file-body").innerText(),
        "core/contract/read/index.test.ts",
      );
    } finally {
      await page.close();
    }
  });
  it("filters every measurement with ranges, restores range state and keeps numeric columns aligned", async () => {
    const report = fixture();
    report.records[2].execution!.feeCharged = "9007199254740993";
    report.records[3].execution!.feeCharged = "9007199254740992";
    const path = join(directory, "ranges.html");
    await Deno.writeTextFile(path, renderReport(report));
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(pathToFileURL(path).href);
      await page.locator("#profiling-tab").click();
      for (
        const [key, min, max, count] of [
          ["duration", "20", "20", 1],
          ["instructions", "1200", "1400", 2],
          ["reads", "2", "2", 3],
          ["writes", "0", "0", 3],
          ["readBytes", "500", "500", 3],
          ["writeBytes", "0", "0", 3],
          ["fee", "120", "120", 3],
          ["charged", "9007199254740993", "9007199254740993", 1],
        ] as const
      ) {
        await page.locator("#range-" + key + "Min").fill(min);
        await page.locator("#range-" + key + "Max").fill(max);
        assertEquals(
          await page.locator("#profile-body tr").count(),
          count,
          key,
        );
        await page.locator("#clear-filters").click();
      }
      await page.locator("#range-durationMin").fill("21");
      await page.locator("#range-durationMax").fill("20");
      assertEquals(
        await page.locator("#range-durationMin").getAttribute("aria-invalid"),
        "true",
      );
      assert(await page.locator("#profile-empty").isVisible());
      await page.locator("#clear-filters").click();
      await page.locator("#range-feeMin").fill("1.5");
      assertEquals(
        await page.locator("#range-feeMin").getAttribute("aria-invalid"),
        "true",
      );
      await page.locator("#clear-filters").click();
      await page.locator("#range-instructionsMin").fill("1200");
      await page.locator("#profile-mode").selectOption("groups");
      assertEquals(await page.locator("#group-body tr").count(), 1);
      assertEquals(
        await page.locator("#group-body tr td").nth(1).innerText(),
        "2",
      );
      await page.locator("#group-body [data-group]").click();
      assertStringIncludes(
        await page.locator("#profile-content").innerText(),
        "2 recorded calls",
      );
      assertEquals(await page.locator("#profile-body tr").count(), 2);
      await page.locator("#profile-mode").selectOption("executions");
      await page.locator("#range-instructionsMin").fill("1400");
      await page.reload();
      assertEquals(
        await page.locator("#range-instructionsMin").inputValue(),
        "1400",
      );
      assertEquals(await page.locator("#profile-body tr").count(), 1);
      await page.locator('#profile-body [data-record="execution-2"]').click();
      await page.goBack();
      assertEquals(
        await page.locator("#range-instructionsMin").inputValue(),
        "1400",
      );
      assertEquals(await page.locator("#profile-body tr").count(), 1);
      assert(
        await page.evaluate(`(() => {
        const table = document.querySelector('.profile-table');
        const headers = [...table.querySelectorAll('th')];
        const cells = [...table.querySelector('tbody tr').children];
        return cells.every((td, i) => !td.classList.contains('num') ||
          getComputedStyle(td).textAlign === 'right' && getComputedStyle(headers[i]).textAlign === 'right') &&
          getComputedStyle(cells[1]).borderRightWidth === '1px' &&
          getComputedStyle(headers[0]).position === 'sticky' &&
          getComputedStyle(cells[0]).position === 'sticky' && cells[0].getBoundingClientRect().width <= 301;
      })()`),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth",
        ),
      );
      assertEquals(errors, []);
    } finally {
      await page.close();
    }
  });
  it("keeps clipboard failure local and clears feedback when leaving the selected call", async () => {
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(fixture()));
      await page.locator('#file-body [data-file="token.test.ts"]').click();
      await page.locator('#detail [data-record="test"]').click();
      await page.locator('#detail [data-record="execution-0"]').click();
      for (
        const title of [
          "Overview",
          "Measurements",
        ]
      ) {
        assert(
          await page.getByRole("heading", { name: title, exact: true })
            .isVisible(),
        );
      }
      await page.evaluate(
        `Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });`,
      );
      await page.getByRole("button", { name: "Copy hash", exact: true })
        .click();
      await page.locator(".hash .copy-feedback").filter({
        hasText: "Clipboard unavailable",
      }).waitFor();
      assertEquals(
        await page.getByRole("button", { name: "Copied", exact: true }).count(),
        0,
      );
      assertEquals(await page.evaluate("getSelection().toString()"), hash);
      await page.locator("#summary-tab").click();
      assertEquals(await page.locator(".copy-feedback:visible").count(), 0);
      await page.locator("#evidence-tab").click();
      assertEquals(await page.locator(".copy-feedback").innerText(), "");
    } finally {
      await page.close();
    }
  });
  it("keeps context controls adjacent and navigates evidence tabs with mouse, keyboard and history", async () => {
    const report = fixture();
    report.records[1].execution!.stages = Array.from(
      { length: 40 },
      (_, index) => ({
        name: "stage " + index,
        startedAt: "2026-09-18T12:00:00Z",
        status: "passed" as const,
        durationMs: index,
        input: { index },
        output: { result: index },
      }),
    );
    report.records[1].execution!.authorization = {
      address: "GTEST",
      invocations: ["balance"],
    };
    const path = join(directory, "detail-tabs.html");
    await Deno.writeTextFile(path, renderReport(report));
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(pathToFileURL(path).href);
      assert(
        await page.locator('#file-body [data-file="token.test.ts"] svg.test')
          .isVisible(),
      );
      await page.locator('#file-body [data-file="token.test.ts"]').click();
      assert(await page.locator("#tree [aria-current] svg.test").isVisible());
      assert(
        await page.locator('#test-body [data-record="test"] svg.test')
          .isVisible(),
      );
      const breadcrumb = await page.locator("#breadcrumbs").boundingBox();
      const clear = await page.locator("#clear-context").boundingBox();
      assert(breadcrumb && clear);
      assert(clear.x - (breadcrumb.x + breadcrumb.width) <= 16);
      assert(clear.x >= breadcrumb.x + breadcrumb.width);
      await page.locator('#detail [data-record="test"]').click();
      assert(await page.locator("#detail h2 svg.test").isVisible());
      await page.locator('#detail [data-record="execution-0"]').click();
      assertEquals(
        await page.getByRole("tablist", { name: "Call evidence" }).count(),
        1,
      );
      assertEquals(await page.locator('[role="tabpanel"]:visible').count(), 1);
      assert(await page.locator("#call-panel-stages").isVisible());
      assertEquals(
        await page.locator("#call-panel-stages tbody tr").count(),
        40,
      );
      await page.evaluate("scrollTo(0, document.body.scrollHeight)");
      const tabBounds = await page.locator("#call-tabs").boundingBox();
      assert(tabBounds && tabBounds.y >= 0 && tabBounds.y < 960);
      await page.getByRole("tab", { name: "Authorization", exact: true })
        .click();
      assert(await page.locator("#call-panel-authorization pre").isVisible());
      assertStringIncludes(
        await page.locator("#call-panel-authorization pre").innerText(),
        "GTEST",
      );
      assert(!(await page.locator("#call-panel-stages").isVisible()));
      await page.keyboard.press("Home");
      assertEquals(
        await page.locator("#call-tab-stages").getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("ArrowRight");
      assert(
        await page.locator("#call-panel-inputs details").first().getAttribute(
          "open",
        ) !== null,
      );
      assert(await page.locator("#call-panel-inputs pre").first().isVisible());
      assertStringIncludes(
        await page.locator("#call-panel-inputs pre").first().innerText(),
        "10000000",
      );
      await page.reload();
      assertEquals(
        await page.locator("#call-tab-inputs").getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("tab", { name: "Authorization", exact: true })
        .click();
      await page.goBack();
      assertEquals(
        await page.locator("#call-tab-inputs").getAttribute("aria-selected"),
        "true",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.getByRole("tab", { name: "Authorization", exact: true })
        .click();
      assert(await page.locator("#call-panel-authorization pre").isVisible());
      assert(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth",
        ),
      );
      await page.locator("#profiling-tab").click();
      await page.locator('#profile-body [data-record="execution-1"]').click();
      assertEquals(
        await page.locator("#call-tab-stages").getAttribute("aria-selected"),
        "true",
      );
      await page.getByRole("tab", { name: "Authorization", exact: true })
        .click();
      assertStringIncludes(
        await page.locator("#call-panel-authorization").innerText(),
        "not captured",
      );
      await page.locator("#clear-context").click();
      assert(!(await page.locator("#clear-context").isVisible()));
      assertEquals(await page.locator("#call-tabs").count(), 0);
      assertEquals(errors, []);
    } finally {
      await page.close();
    }
  });
  it("handles empty, incomplete and nonzero-source artifacts without implying success", async () => {
    const report = fixture();
    report.records = [];
    report.complete = false;
    report.exitCode = 1;
    report.diagnostics = ["Interrupted run"];
    const page = await browser.newPage();
    try {
      await page.setContent(renderReport(report));
      assertStringIncludes(
        await page.locator("#summary-view").innerText(),
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
      assertStringIncludes(
        await page.locator("#warnings").innerText(),
        "code 1",
      );
      await page.locator("#evidence-tab").click();
      assertStringIncludes(
        await page.locator("#detail").innerText(),
        "Select a file",
      );
    } finally {
      await page.close();
    }
  });
});
