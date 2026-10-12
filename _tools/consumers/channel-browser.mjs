// Execute installed channel workers through Vite, in development and production.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, createServer, preview } from "vite";
import { chromium, firefox, webkit } from "playwright";
import { conveeWorkers } from "@jsr/fifo__convee/workers/vite";
import { runBrowserFixture } from "./browser-fixture.mjs";

const root = fileURLToPath(new URL("./", import.meta.url));
const workerPath = new URL("./channel-worker.ts", import.meta.url);
const workerSource = await readFile(workerPath, "utf8");
await writeFile(
  workerPath,
  workerSource.replace(
    'from "@jsr/fifo__convee/workers"',
    'from "@fifo/convee/workers"',
  ),
);
await writeFile(
  new URL("./index.html", import.meta.url),
  '<!doctype html><script type="module" src="/channel-browser.ts"></script>',
);
await writeFile(
  new URL("./channel-browser.ts", import.meta.url),
  `
import definition from "./channel-worker.ts";
import { checkChannelWorkers } from "./channel-workers.ts";
await checkChannelWorkers(definition);
(globalThis as unknown as { colibriPassed: boolean }).colibriPassed = true;
`,
);
const config = {
  configFile: false,
  root,
  clearScreen: false,
  logLevel: "warn",
  plugins: [conveeWorkers()],
  resolve: {
    alias: {
      "@fifo/convee/workers": fileURLToPath(
        import.meta.resolve("@jsr/fifo__convee/workers"),
      ),
    },
  },
  build: { outDir: "channel-dist", target: "esnext" },
  server: { host: "127.0.0.1", port: 0 },
  preview: { host: "127.0.0.1", port: 0 },
};
async function inspect(url, mode) {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      await runBrowserFixture(browser, url);
      console.log(
        `Channel workers: ${engine.name()} ${browser.version()} / ${mode}`,
      );
    } finally {
      await browser.close();
    }
  }
}
const server = await createServer(config);
try {
  await server.listen();
  await inspect(server.resolvedUrls.local[0], "development");
} finally {
  await server.close();
}
await build(config);
const built = await preview(config);
try {
  await inspect(built.resolvedUrls.local[0], "production");
} finally {
  await new Promise((resolve, reject) =>
    built.httpServer.close((error) => error ? reject(error) : resolve())
  );
}
