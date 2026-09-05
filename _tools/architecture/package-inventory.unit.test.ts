import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  packageEntrypoints,
  readPackageInventory,
} from "colibri-tools/package-inventory.ts";
import { PACKAGE_ARCHITECTURES } from "colibri-tools/architecture/shared.ts";

describe("published package inventory", () => {
  it("covers the workspace and every declared subpath, including RPC Streamer", async () => {
    const packages = await readPackageInventory(Deno.cwd());
    assertEquals(
      packages.map((p) => p.name).sort(),
      PACKAGE_ARCHITECTURES.map((p) => p.name).sort(),
    );
    const paths = packageEntrypoints(packages);
    assertEquals(paths.includes("rpc-streamer/mod.ts"), true);
    assertEquals(
      paths.filter((p) => p.startsWith("build-verification/")).length,
      4,
    );
  });

  it("deduplicates multiple exported names for the same entrypoint", () => {
    assertEquals(
      packageEntrypoints([{
        root: "example",
        name: "@colibri/example",
        version: "1.0.0",
        exports: {
          ".": "./mod.ts",
          "./alias": "./mod.ts",
          "./extra": "./extra.ts",
        },
      }]),
      ["example/extra.ts", "example/mod.ts"],
    );
  });

  it("rejects missing entrypoints, incomplete manifests, and escaping exports", async () => {
    const root = await Deno.makeTempDir({ prefix: "colibri-inventory-" });
    try {
      await Deno.writeTextFile(
        `${root}/deno.json`,
        JSON.stringify({ workspace: ["./pkg"] }),
      );
      await Deno.mkdir(`${root}/pkg`);
      for (
        const manifest of [
          { name: "@colibri/example", version: "1", exports: "./absent.ts" },
          { name: "@colibri/example", version: "1", exports: "../deno.json" },
          { name: "@colibri/example", exports: "./mod.ts" },
        ]
      ) {
        await Deno.writeTextFile(
          `${root}/pkg/deno.json`,
          JSON.stringify(manifest),
        );
        await assertRejects(() => readPackageInventory(root));
      }
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
});
