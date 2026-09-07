// Execute the real bundle, cryptography, and extension fixture in three engines.
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { runBrowserFixture } from "./browser-fixture.mjs";

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
      await runBrowserFixture(
        browser,
        `http://127.0.0.1:${server.address().port}`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
