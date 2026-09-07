/** Explicit version mechanics for reviewed releases; never commits or publishes. */
import { resolve } from "node:path";
import { assertApplied, planReleases, readPlan } from "./model.ts";
import {
  git,
  packageStates,
  planPath,
  repositoryRoot as defaultRoot,
} from "./repository.ts";

export async function runReleaseCli(
  repositoryRoot: string,
  argv: string[],
): Promise<void> {
  const [mode, ...args] = argv;
  if (
    !["init", "plan", "apply", "check"].includes(mode) ||
    (mode === "init" ? args.length > 1 : args.length > 0 &&
      !(mode === "check" && args.length === 2 && args[0] === "--base"))
  ) {
    throw new Error(
      "RELEASE_USAGE: init [ref] | plan | apply | check [--base ref]",
    );
  }
  const path = resolve(repositoryRoot, planPath);
  if (mode === "init") {
    const base = await git(
      repositoryRoot,
      "rev-parse",
      args[0] ?? "origin/main",
    );
    const existing = readPlan(await Deno.readTextFile(path));
    if (existing.base === base) {
      console.log(
        "Keeping the existing cumulative release plan for this baseline.",
      );
    } else {
      await Deno.writeTextFile(
        path,
        JSON.stringify({ schema: 1, base, packages: {} }, null, 2) + "\n",
      );
      console.log(
        "New baseline recorded. Add reviewed package intents before applying versions.",
      );
    }
  } else {
    const plan = readPlan(await Deno.readTextFile(path));
    if (args[0] === "--base") {
      const expected = await git(repositoryRoot, "rev-parse", args[1]);
      if (plan.base !== expected) {
        throw new Error(
          "RELEASE_STALE_BASELINE: run release:init against fetched origin/main and review the cumulative intents",
        );
      }
    }
    const releases = planReleases(
      await packageStates(repositoryRoot, plan),
      plan,
    );
    if (mode === "apply") {
      for (const pkg of releases) {
        if (!pkg.intent) continue;
        if (pkg.version !== pkg.targetVersion) {
          if (pkg.version !== pkg.previousVersion) {
            throw new Error(
              `RELEASE_ALREADY_EDITED: ${pkg.name} is neither the baseline nor reviewed target; reconcile it explicitly`,
            );
          }
          const result = await new Deno.Command(Deno.execPath(), {
            cwd: repositoryRoot,
            args: [
              "bump-version",
              "--config",
              `${pkg.root}/deno.json`,
              pkg.intent.bump,
            ],
            stdout: "inherit",
            stderr: "inherit",
          }).output();
          if (!result.success) {
            throw new Error(`RELEASE_BUMP_FAILED: ${pkg.name}`);
          }
        }
        const manifestPath = resolve(repositoryRoot, pkg.root, "deno.json");
        const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
        for (const [alias, value] of Object.entries(manifest.imports ?? {})) {
          for (
            const [dependency, range] of Object.entries(
              pkg.intent.dependencies ?? {},
            )
          ) {
            if (String(value).startsWith(`jsr:${dependency}@`)) {
              manifest.imports[alias] = `jsr:${dependency}@${range}`;
            }
          }
        }
        await Deno.writeTextFile(
          manifestPath,
          JSON.stringify(manifest, null, 2) + "\n",
        );
      }
      const build = releases.find((pkg) =>
        pkg.name === "@colibri/build-verification"
      )!;
      const versionPath = resolve(
        repositoryRoot,
        "build-verification/src/core/evidence/accumulate.ts",
      );
      const versionSource = await Deno.readTextFile(versionPath);
      await Deno.writeTextFile(
        versionPath,
        versionSource.replace(
          /BUILD_VERIFICATION_PACKAGE_VERSION = "[^"]+"/,
          `BUILD_VERIFICATION_PACKAGE_VERSION = "${build.targetVersion}"`,
        ),
      );
    }
    if (mode !== "plan") {
      assertApplied(
        planReleases(await packageStates(repositoryRoot, plan), plan),
      );
    }
    for (const pkg of releases) {
      console.log(
        `${pkg.name}: ${pkg.previousVersion} -> ${pkg.targetVersion}${
          pkg.intent ? ` (${pkg.intent.reason})` : " (no release)"
        }`,
      );
    }
  }
}

if (import.meta.main) await runReleaseCli(defaultRoot, Deno.args);
