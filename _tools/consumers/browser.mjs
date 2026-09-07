// Execute the real bundle, cryptography, and extension fixture in three engines.
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./browser.js", import.meta.url));
const server = createServer((request, response) => {
  if (request.url === "/browser.js") {
    response.writeHead(200, { "content-type": "text/javascript" });
    response.end(source);
  } else {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(
      '<!doctype html><script type="module" src="/browser.js"></script>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      console.log(`${engine.name()}: ${browser.version()}`);
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => {
        errors.push(error);
        console.error(`${engine.name()}: ${error.stack ?? error.message}`);
      });
      page.on("requestfailed", (request) => {
        console.error(
          `${engine.name()}: ${request.url()}: ${request.failure()?.errorText}`,
        );
      });
      page.on(
        "console",
        (message) => console.log(`${engine.name()}: ${message.text()}`),
      );
      // The fixture's explicit completion signal, not the document load event,
      // is the success criterion for these asynchronous SDK operations.
      await page.goto(`http://127.0.0.1:${server.address().port}`, {
        waitUntil: "commit",
      });
      await page.waitForFunction(
        () => globalThis.colibriPassed === true,
        undefined,
        { timeout: 30_000 },
      );
      if (errors.length) {
        throw new AggregateError(errors, "Browser consumer failed");
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
