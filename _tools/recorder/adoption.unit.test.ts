import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse } from "yaml";
import { readPackageInventory } from "../package-inventory.ts";
import { root } from "../consumers/environment.ts";
import { join } from "node:path";

describe("whole-suite recorder adoption", () => {
  it("routes every package BDD suite through the shared file-aware adapter", async () => {
    let suites = 0;
    async function check(path: string): Promise<void> {
      for await (const entry of Deno.readDir(path)) {
        const child = join(path, entry.name);
        if (entry.isDirectory && entry.name !== "node_modules") {
          await check(child);
        }
        if (!entry.isFile || !entry.name.endsWith(".test.ts")) continue;
        const source = await Deno.readTextFile(child);
        assert(
          !/^import\b[^;]*from\s+["']@std\/testing\/bdd["']/m.test(source),
          child,
        );
        if (/recordColibriTests\(\s*import\.meta\.url\s*,?\s*\)/.test(source)) {
          suites++;
        }
      }
    }
    for (const pkg of await readPackageInventory(root)) {
      await check(join(root, pkg.root));
    }
    assert(
      suites > 250,
      "The inventory must include the complete package suite",
    );
  });
  it("records every CI shard, uploads failures and aggregates all expected artifacts", async () => {
    const workflow = parse(
      await Deno.readTextFile(join(root, ".github/workflows/deno.yml")),
    ) as {
      jobs: Record<
        string,
        {
          strategy?: { matrix: { include: Record<string, string>[] } };
          steps: {
            name?: string;
            run?: string;
            if?: string;
            with?: Record<string, string>;
          }[];
          needs?: string[];
        }
      >;
    };
    const expected = new Set<string>();
    for (const key of ["package_tests", "build_verification_tests"]) {
      const job = workflow.jobs[key];
      assert(
        job.steps.some((step) => step.run?.includes("deno task test:record")),
      );
      const upload = job.steps.find((step) =>
        step.with?.name?.startsWith("test-evidence-")
      );
      assertEquals(upload?.if, "always()");
      for (const shard of job.strategy!.matrix.include) {
        expected.add(shard.package ?? `build-verification-${shard.shard}`);
      }
    }
    const merger = workflow.jobs.evidence.steps.find((s) =>
      s.run?.includes("test:record:merge")
    )!.run!;
    assertEquals(
      new Set(merger.match(/--expected=([^\s]+)/)![1].split(",")),
      expected,
    );
    assert(workflow.jobs.test.needs!.includes("evidence"));
  });
});
