import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { type Browser, chromium } from "npm:playwright@1.61.0";
import { runBrowserFixture } from "./browser-fixture.mjs";

describe("browser consumer failure diagnostics", () => {
  let browser: Browser;
  let server: Deno.HttpServer<Deno.NetAddr>;
  let origin: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    server = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen() {} },
      (request) => {
        const path = new URL(request.url).pathname;
        const script = {
          "/success":
            "setTimeout(() => { globalThis.colibriPassed = true; }, 50);",
          "/early-error": 'throw new Error("early fixture failure");',
          "/async-error":
            'setTimeout(() => { throw new Error("async fixture failure"); }, 50);',
          "/no-signal": 'console.log("fixture did not complete");',
        }[path];
        return new Response(`<!doctype html><script>${script}</script>`, {
          headers: { "content-type": "text/html" },
        });
      },
    );
    origin = `http://127.0.0.1:${server.addr.port}`;
  });

  afterAll(async () => {
    await browser.close();
    await server.shutdown();
  });

  it("waits for asynchronous completion and closes its page/context", async () => {
    await runBrowserFixture(browser, `${origin}/success`);
    assertEquals(browser.contexts().length, 0);
  });

  for (const kind of ["early", "async"] as const) {
    it(`reports the original ${kind} page error without waiting 30 seconds`, async () => {
      const started = performance.now();
      const error = await assertRejects(
        () => runBrowserFixture(browser, `${origin}/${kind}-error`),
        AggregateError,
        "Browser consumer failed",
      );
      assertStringIncludes(error.errors[0].message, `${kind} fixture failure`);
      assert(
        performance.now() - started < 15_000,
        "Page errors must bypass the 30-second completion timeout",
      );
      assertEquals(browser.contexts().length, 0);
    });
  }

  it("still rejects missing completion signals and closes the page", async () => {
    await assertRejects(
      () => runBrowserFixture(browser, `${origin}/no-signal`, 500),
      Error,
      "Timeout",
    );
    assertEquals(browser.contexts().length, 0);
  });

  it("preserves real navigation failures and closes the page", async () => {
    await assertRejects(
      () => runBrowserFixture(browser, "http://127.0.0.1:0", 500),
      Error,
      "page.goto",
    );
    assertEquals(browser.contexts().length, 0);
  });
});
