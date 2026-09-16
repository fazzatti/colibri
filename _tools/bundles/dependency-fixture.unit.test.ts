import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { resolve } from "node:path";
import { prepareSource } from "colibri-tools/consumers/environment.ts";
import { entries } from "colibri-tools/bundles/fixtures.ts";

describe("frozen production dependency fixture", () => {
  it("resolves the actual isolated inputs without writes and rejects missing dependency metadata", async () => {
    assertEquals(Deno.version.deno, "2.9.6", "Use the pinned bundle runtime.");
    const source = await Deno.makeTempDir({
      prefix: "colibri-frozen-fixture-",
    });
    try {
      await prepareSource(source, "17.0.1");
      const fixture = await Deno.readTextFile(
        new URL("./dependencies.lock", import.meta.url),
      );
      const lockPath = resolve(source, "deno.lock");
      await Deno.writeTextFile(lockPath, fixture);
      for (const [name, entry] of Object.entries(entries)) {
        await Deno.writeTextFile(resolve(source, `${name}.ts`), entry);
      }
      const cache = () =>
        new Deno.Command(Deno.execPath(), {
          cwd: source,
          args: [
            "cache",
            "--frozen-lockfile",
            "--config",
            "deno.json",
            ...Object.keys(entries).map((name) => `${name}.ts`),
          ],
        }).output();
      const current = await cache();
      assertEquals(
        current.success,
        true,
        new TextDecoder().decode(current.stderr),
      );
      assertEquals(await Deno.readTextFile(lockPath), fixture);

      // Package versions can match while root import-map dependencies drift.
      // Exercise Deno's real frozen-lock validation, not just our version guard.
      const stale = JSON.parse(fixture);
      stale.workspace.dependencies.pop();
      const staleText = JSON.stringify(stale, null, 2) + "\n";
      await Deno.writeTextFile(lockPath, staleText);
      const rejected = await cache();
      assertEquals(rejected.success, false);
      assertStringIncludes(
        new TextDecoder().decode(rejected.stderr),
        "lockfile is out of date",
      );
      assertEquals(await Deno.readTextFile(lockPath), staleText);
    } finally {
      await Deno.remove(source, { recursive: true });
    }
  });
});
