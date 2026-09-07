import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { dirname, resolve } from "node:path";
import { type ReleasePlan } from "./model.ts";
import { git } from "./repository.ts";

async function write(
  root: string,
  path: string,
  value: unknown,
): Promise<void> {
  const destination = resolve(root, path);
  await Deno.mkdir(dirname(destination), { recursive: true });
  await Deno.writeTextFile(
    destination,
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
  );
}

async function execute(root: string, ...args: string[]) {
  const output = await new Deno.Command(Deno.execPath(), {
    cwd: root,
    args: ["run", "-A", "_tools/releases/api.ts", ...args],
  }).output();
  return {
    success: output.success,
    code: output.code,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

/** Exercise the real CLI, Deno declarations and Git baseline in an isolated repo. */
async function fixture(
  run: (root: string, plan: ReleasePlan) => Promise<void>,
): Promise<void> {
  const root = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "colibri-api-report-" }),
  );
  try {
    await write(root, "deno.json", { workspace: ["core"], lock: false });
    await write(root, "core/deno.json", {
      name: "@colibri/core",
      version: "1.0.0",
      exports: "./mod.ts",
    });
    await write(root, "core/mod.ts", "export const existing: number = 1;\n");
    for (
      const file of [
        "api.ts",
        "api-model.ts",
        "documentation.ts",
        "repository.ts",
        "model.ts",
      ]
    ) {
      await write(
        root,
        `_tools/releases/${file}`,
        await Deno.readTextFile(new URL(file, import.meta.url)),
      );
    }
    await write(
      root,
      "_tools/package-inventory.ts",
      await Deno.readTextFile(
        new URL("../package-inventory.ts", import.meta.url),
      ),
    );
    const update = await execute(root, "--update");
    assertEquals(update.success, true, update.stderr);
    await git(root, "init", "-b", "fixture");
    await git(root, "add", ".");
    await git(
      root,
      "-c",
      "user.name=Colibri fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "API fixture baseline",
    );
    const plan: ReleasePlan = {
      schema: 1,
      base: await git(root, "rev-parse", "HEAD"),
      packages: {
        "@colibri/core": {
          bump: "minor",
          reason: "Fixture API addition",
          apiReview: "Fixture reviewed",
        },
      },
    };
    await write(root, "_tools/releases/plan.json", plan);
    await run(root, plan);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

describe("API CLI reports survive failed checks", () => {
  it("emits valid JSON and exits successfully for reviewed declarations", async () => {
    await fixture(async (root) => {
      const output = await execute(root);
      assertEquals(output.success, true, output.stderr);
      assertEquals(JSON.parse(output.stdout), {
        toolchain: Deno.version,
        changes: [],
        unreviewed: [],
      });
    });
  });

  it("reports unreviewed declarations before exiting unsuccessfully", async () => {
    await fixture(async (root) => {
      await write(
        root,
        "core/mod.ts",
        "export const existing: number = 1;\nexport const added: number = 2;\n",
      );
      const output = await execute(root);
      assertEquals(output.success, false);
      assert(output.code !== 0);
      const report = JSON.parse(output.stdout);
      assertEquals(report.unreviewed, [{
        entrypoint: "@colibri/core",
        symbol: "added",
        kind: "added",
      }]);
      assertStringIncludes(report.error, "API_UNREVIEWED");
      assertStringIncludes(output.stderr, "API_UNREVIEWED");
    });
  });

  it("preserves baseline changes when release intent lacks API approval", async () => {
    await fixture(async (root, plan) => {
      await write(
        root,
        "core/mod.ts",
        "export const existing: number = 1;\nexport const added: number = 2;\n",
      );
      assertEquals((await execute(root, "--update")).success, true);
      delete plan.packages["@colibri/core"].apiReview;
      await write(root, "_tools/releases/plan.json", plan);
      const failed = await execute(root);
      assertEquals(failed.success, false);
      const report = JSON.parse(failed.stdout);
      assertEquals(report.changes, [{
        entrypoint: "@colibri/core",
        symbol: "added",
        kind: "added",
      }]);
      assertStringIncludes(report.error, "API_REVIEW_MISSING");
      assertStringIncludes(failed.stderr, "API_REVIEW_MISSING");

      plan.packages["@colibri/core"].apiReview = "Explicitly reviewed";
      await write(root, "_tools/releases/plan.json", plan);
      const approved = await execute(root);
      assertEquals(approved.success, true, approved.stderr);
      assertEquals(JSON.parse(approved.stdout).changes, report.changes);
    });
  });

  it("retains the major-release requirement and reports removed symbols", async () => {
    await fixture(async (root, plan) => {
      await write(
        root,
        "core/mod.ts",
        "export const replacement: number = 2;\n",
      );
      assertEquals((await execute(root, "--update")).success, true);
      const failed = await execute(root);
      assertEquals(failed.success, false);
      const report = JSON.parse(failed.stdout);
      assertEquals(report.changes[0], {
        entrypoint: "@colibri/core",
        symbol: "existing",
        kind: "removed",
      });
      assertStringIncludes(report.error, "API_REMOVAL_REQUIRES_MAJOR");
      assertStringIncludes(failed.stderr, "API_REMOVAL_REQUIRES_MAJOR");

      plan.packages["@colibri/core"].bump = "major";
      await write(root, "_tools/releases/plan.json", plan);
      const approved = await execute(root);
      assertEquals(approved.success, true, approved.stderr);
      assertEquals(JSON.parse(approved.stdout).changes, report.changes);
    });
  });

  it("emits diagnostics even when declaration generation cannot complete", async () => {
    await fixture(async (root) => {
      await write(root, "core/mod.ts", "export type Broken = ;\n");
      const output = await execute(root);
      assertEquals(output.success, false);
      assertStringIncludes(JSON.parse(output.stdout).error, "API_DOC_FAILED");
      assertStringIncludes(output.stderr, "API_DOC_FAILED");
    });
  });

  it("keeps update-mode failures on stderr without claiming a check report", async () => {
    await fixture(async (root) => {
      await write(root, "core/mod.ts", "export type Broken = ;\n");
      const output = await execute(root, "--update");
      assertEquals(output.success, false);
      assertEquals(output.stdout, "");
      assertStringIncludes(output.stderr, "API_DOC_FAILED");
    });
  });

  it("uploads reports after failures without running when their producer was skipped", async () => {
    const workflow = await Deno.readTextFile(
      new URL("../../.github/workflows/deno.yml", import.meta.url),
    );
    assertStringIncludes(
      workflow,
      "      - name: Check reviewed public declarations\n        id: public-api\n",
    );
    assertStringIncludes(
      workflow,
      "      - name: Upload public API change report\n        if: ${{ !cancelled() && steps.public-api.outcome != 'skipped' }}\n",
    );
    assertStringIncludes(
      workflow,
      'run: deno task release:api:check > "${{ runner.temp }}/public-api-changes.json"',
    );
  });
});
