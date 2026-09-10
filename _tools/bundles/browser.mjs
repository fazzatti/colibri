import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const entries = JSON.parse(await readFile("entries.json", "utf8"));
const address = "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO";
const server = createServer(async (request, response) => {
  if (request.url === "/") {
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><title>Colibri bundle tests</title>");
    return;
  }
  const match = /^\/(deno|rollup)\/([a-z-]+)\.js$/.exec(request.url);
  if (!match || !entries.includes(match[2])) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.setHeader("content-type", "text/javascript");
    response.end(await readFile(`..${request.url}`));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const results = [];
let svgHash;
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      for (const bundler of ["deno", "rollup"]) {
        for (const name of entries) {
          const value = await page.evaluate(
            async ({ name, bundler, address }) => {
              const module = await import(`/${bundler}/${name}.js`);
              if (name === "unused-core") return module.value === 1;
              if (name.endsWith("error") || name === "errors") {
                const error = new module.ColibriError({
                  domain: "tools",
                  source: "bundle-probe",
                  code: "PROBE_001",
                  message: "Probe",
                });
                return error instanceof Error &&
                  error.toJSON().code === "PROBE_001";
              }
              if (name.endsWith("strkey")) {
                return module.StrKey.isValidEd25519PublicKey(address);
              }
              if (name === "value-symbol" || name === "value-namespace") {
                const value = module.symbol.from("ADMIN");
                if (
                  module.symbol.fromXdr(value.toXdr("base64"))
                    .value !== "ADMIN"
                ) return false;
                try {
                  module.symbol.from("invalid symbol");
                } catch (error) {
                  return error.code === "SV_001";
                }
                return false;
              }
              if (name.startsWith("svg")) return module.toSvg(address);
              return module.verify(address);
            },
            { name, bundler, address },
          );
          if (typeof value === "string") {
            const hash = createHash("sha256").update(value).digest("hex");
            svgHash ??= hash;
            if (hash !== svgHash) {
              throw new Error(`SVG changed: ${name} in ${bundler}`);
            }
          } else if (value !== true) {
            throw new Error(`Browser assertion failed: ${name} in ${bundler}`);
          }
        }
      }
      if (errors.length) throw new AggregateError(errors);
      results.push({
        engine: engine.name(),
        version: browser.version(),
        bundles: entries.length * 2,
        svgHash,
      });
      console.log(
        `${engine.name()}: ${entries.length * 2} production bundles executed`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
await writeFile("../browsers.json", JSON.stringify(results, null, 2));
