// Execute the real bundle, cryptography, and extension fixture in three engines.
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { runBrowserFixture } from "./browser-fixture.mjs";
import { checkReactBrowser, createReactRpcFixture } from "./react-browser.mjs";

const source = await readFile(new URL("./browser.js", import.meta.url));
const rpc = createReactRpcFixture();
const server = createServer((request, response) => {
  if (request.url === "/react-rpc") {
    void rpc.respond(request, response).catch((error) => {
      console.error(error);
      response.writeHead(500);
      response.end(String(error));
    });
    return;
  }
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
    rpc.reset();
    const browser = await engine.launch();
    try {
      console.log(`${engine.name()}: ${browser.version()}`);
      await runBrowserFixture(
        browser,
        `http://127.0.0.1:${server.address().port}`,
        30_000,
        (page) => checkReactBrowser(page, rpc),
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
