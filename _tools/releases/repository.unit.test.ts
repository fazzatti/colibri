import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { dirname, resolve } from "node:path";
import { runReleaseCli } from "./cli.ts";
import { readPlan, type ReleasePlan } from "./model.ts";
import { git, packageStates, planPath, runtimeImports } from "./repository.ts";
import { restorePackage } from "../consumers/release-tree.ts";

/** Real disposable repositories: no mutation of the checkout or user Git config. */
async function fixture(
  run: (root: string, plan: ReleasePlan) => Promise<void>,
): Promise<void> {
  const root = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "colibri-release-test-" }),
  );
  try {
    await write(root, "deno.json", {
      workspace: ["core", "build-verification", "plugins/example"],
      imports: { sdk: "npm:example@1.0.0" },
    });
    for (
      const [directory, name, version, imports] of [
        ["core", "@colibri/core", "1.0.0", {}],
        ["build-verification", "@colibri/build-verification", "0.4.0", {}],
        ["plugins/example", "@colibri/example", "1.0.0", {
          "jsr:@colibri/core": "jsr:@colibri/core@^1.0.0",
        }],
      ] as const
    ) {
      await write(root, `${directory}/deno.json`, {
        name,
        version,
        exports: "./mod.ts",
        imports,
      });
      await write(root, `${directory}/mod.ts`, "export const value = 1;\n");
    }
    await write(root, "core/source.ts", 'export { value } from "sdk";\n');
    await write(
      root,
      "build-verification/src/core/evidence/accumulate.ts",
      'export const BUILD_VERIFICATION_PACKAGE_VERSION = "0.4.0";\n',
    );
    await git(root, "init", "-b", "fixture");
    await commit(root);
    const plan: ReleasePlan = {
      schema: 1,
      base: await git(root, "rev-parse", "HEAD"),
      packages: {},
    };
    await write(root, planPath, plan);
    await run(root, plan);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

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

async function commit(root: string): Promise<void> {
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
    "Fixture baseline",
  );
}

describe("release repository and native version editing", () => {
  it("restores historical package contents and their root imports from an immutable ref", async () => {
    await fixture(async (root, plan) => {
      const consumer = await Deno.makeTempDir({
        prefix: "colibri-release-tree-test-",
      });
      try {
        await write(consumer, "core/obsolete.ts", "not in the release\n");
        await write(consumer, "plugins/example/keep.ts", "untouched\n");
        await write(root, "core/mod.ts", "uncommitted candidate change\n");
        await write(root, "deno.json", {
          workspace: ["core"],
          imports: { sdk: "newer" },
        });
        assertEquals(await restorePackage(root, consumer, "core", plan.base), {
          sdk: "npm:example@1.0.0",
        });
        assertEquals(
          await Deno.readTextFile(resolve(consumer, "core/mod.ts")),
          "export const value = 1;\n",
        );
        await assertRejects(
          () => Deno.stat(resolve(consumer, "core/obsolete.ts")),
          Deno.errors.NotFound,
        );
        assertEquals(
          await Deno.readTextFile(resolve(consumer, "plugins/example/keep.ts")),
          "untouched\n",
        );
        await assertRejects(
          () => restorePackage(root, consumer, "core", "missing-ref"),
          Error,
          "CONSUMER_ARCHIVE_FAILED",
        );
      } finally {
        await Deno.remove(consumer, { recursive: true });
      }
    });
  });
  it("detects root runtime dependency changes without releasing unrelated packages", async () => {
    await fixture(async (root, plan) => {
      assertEquals(
        (await packageStates(root, plan)).some((pkg) => pkg.changed),
        false,
      );
      await write(root, "deno.json", {
        workspace: ["core", "build-verification", "plugins/example"],
        imports: { sdk: "npm:example@1.1.0" },
      });
      assertEquals(
        (await packageStates(root, plan)).filter((pkg) => pkg.changed).map((
          pkg,
        ) => pkg.name),
        ["@colibri/core"],
      );
      await assertRejects(
        () => runReleaseCli(root, ["check"]),
        Error,
        "RELEASE_MISSING_INTENT",
      );
    });
  });

  it("ignores test-only imports and changes, but includes new runtime files and published docs", async () => {
    await fixture(async (root, plan) => {
      await write(root, "core/sample.unit.test.ts", 'import "test-only";\n');
      await write(
        root,
        "core/node_modules/vendor/mod.ts",
        'import "ignored";\n',
      );
      await git(root, "add", "core/sample.unit.test.ts");
      // Git-ignored install artifacts are excluded by the same repository rules.
      await write(root, ".gitignore", "node_modules/\n");
      assertEquals([...await runtimeImports(resolve(root, "core"))], ["sdk"]);
      assertEquals(
        (await packageStates(root, plan)).some((pkg) => pkg.changed),
        false,
      );
      await write(root, "core/new-feature.ts", "export const next = 2;\n");
      await write(
        root,
        "plugins/example/README.md",
        "# Updated public guide\n",
      );
      assertEquals(
        (await packageStates(root, plan)).filter((pkg) => pkg.changed).map((
          pkg,
        ) => pkg.name),
        ["@colibri/core", "@colibri/example"],
      );
    });
  });

  it("applies one cumulative native bump and explicit floors, including JSR-prefixed aliases", async () => {
    await fixture(async (root, plan) => {
      plan.packages = {
        "@colibri/core": { bump: "minor", reason: "New optional capability" },
        "@colibri/example": {
          bump: "minor",
          reason: "Uses the new Core capability",
          dependencies: { "@colibri/core": "^1.1.0" },
        },
        "@colibri/build-verification": {
          bump: "patch",
          reason: "Version constant regression",
        },
      };
      await write(root, planPath, plan);
      await runReleaseCli(root, ["plan"]);
      await runReleaseCli(root, ["apply"]);
      const first = await git(root, "diff");
      await runReleaseCli(root, ["apply"]);
      assertEquals(await git(root, "diff"), first);
      await runReleaseCli(root, ["check", "--base", "HEAD"]);
      const plugin = JSON.parse(
        await Deno.readTextFile(resolve(root, "plugins/example/deno.json")),
      );
      assertEquals(plugin.version, "1.1.0");
      assertEquals(
        plugin.imports["jsr:@colibri/core"],
        "jsr:@colibri/core@^1.1.0",
      );
      assertEquals(
        await Deno.readTextFile(
          resolve(root, "build-verification/src/core/evidence/accumulate.ts"),
        ),
        'export const BUILD_VERIFICATION_PACKAGE_VERSION = "0.4.1";\n',
      );
      await runReleaseCli(root, ["init", "HEAD"]);
      assertEquals(
        readPlan(await Deno.readTextFile(resolve(root, planPath))),
        plan,
      );
      await commit(root);
      await assertRejects(
        () => runReleaseCli(root, ["check", "--base", "HEAD"]),
        Error,
        "RELEASE_STALE_BASELINE",
      );
      await runReleaseCli(root, ["init", "HEAD"]);
      assertEquals(
        readPlan(await Deno.readTextFile(resolve(root, planPath))).packages,
        {},
      );
    });
  });

  it("rejects conflicting manual bumps, malformed commands and unavailable Git refs", async () => {
    await fixture(async (root, plan) => {
      for (
        const args of [[], ["unknown"], ["check", "--base"], [
          "apply",
          "anything",
        ], ["init", "one", "two"]]
      ) {
        await assertRejects(
          () => runReleaseCli(root, args),
          Error,
          "RELEASE_USAGE",
        );
      }
      await assertRejects(
        () => runReleaseCli(root, ["check", "--base", "missing-ref"]),
        Error,
        "RELEASE_GIT_FAILED",
      );
      plan.packages["@colibri/core"] = {
        bump: "minor",
        reason: "One reviewed minor",
      };
      await write(root, planPath, plan);
      await write(root, "core/deno.json", {
        name: "@colibri/core",
        version: "1.2.0",
        exports: "./mod.ts",
      });
      await assertRejects(
        () => runReleaseCli(root, ["apply"]),
        Error,
        "RELEASE_ALREADY_EDITED",
      );
    });
  });

  it("rejects a reused plan on a subsequent push until its baseline and bump are renewed", async () => {
    await fixture(async (root, plan) => {
      plan.packages["@colibri/core"] = {
        bump: "patch",
        reason: "First reviewed correction",
      };
      await write(root, planPath, plan);
      await runReleaseCli(root, ["apply"]);
      await commit(root);
      const beforePush = await git(root, "rev-parse", "HEAD");

      // Another push changes published code but leaves the already-used plan.
      await write(root, "core/mod.ts", "export const value = 2;\n");
      await commit(root);
      await runReleaseCli(root, ["check"]);
      await assertRejects(
        () => runReleaseCli(root, ["check", "--base", beforePush]),
        Error,
        "RELEASE_STALE_BASELINE",
      );

      // Renew against the pre-push commit, not the pushed commit now on main.
      await runReleaseCli(root, ["init", beforePush]);
      await assertRejects(
        () => runReleaseCli(root, ["check", "--base", beforePush]),
        Error,
        "RELEASE_MISSING_INTENT",
      );
      const renewed = readPlan(
        await Deno.readTextFile(resolve(root, planPath)),
      );
      renewed.packages["@colibri/core"] = {
        bump: "patch",
        reason: "Second reviewed correction",
      };
      await write(root, planPath, renewed);
      await assertRejects(
        () => runReleaseCli(root, ["check", "--base", beforePush]),
        Error,
        "RELEASE_VERSION_MISMATCH",
      );
      await runReleaseCli(root, ["apply"]);
      await runReleaseCli(root, ["check", "--base", beforePush]);
      assertEquals(
        JSON.parse(await Deno.readTextFile(resolve(root, "core/deno.json")))
          .version,
        "1.0.2",
      );
    });
  });

  it("binds publication validation to the pre-push commit", async () => {
    const workflow = await Deno.readTextFile(
      new URL("../../.github/workflows/publish.yml", import.meta.url),
    );
    assertStringIncludes(
      workflow,
      "      - name: Validate reviewed release plan\n" +
        "        env:\n" +
        "          RELEASE_BASE: ${{ github.event.before }}\n" +
        '        run: deno task release:check --base "$RELEASE_BASE"\n',
    );
  });
});
