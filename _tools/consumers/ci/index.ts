/** One CI compatibility job, with separately logged runtime phases and a complete summary. */
import { resolve } from "node:path";
import {
  compatibilityChecks,
  type SdkResolution,
  sdkSelections,
  verifyRuntime,
} from "./plan.ts";
import { runChecks, summarize } from "./runner.ts";

const [phase, destination] = Deno.args;
if (!phase || !destination) {
  throw new Error("Usage: check:consumers:ci <plan|phase|summary> <directory>");
}
const directory = resolve(destination);
const planPath = resolve(directory, "plan.json");
if (phase === "plan") {
  const { resolveSdk } = await import("../sdk.ts");
  const resolutions = await Promise.all(
    sdkSelections.map(async (selection) => ({
      selection,
      version: await resolveSdk(selection),
    })),
  );
  const checks = compatibilityChecks(resolutions, directory);
  await Deno.mkdir(directory, { recursive: true });
  await Deno.writeTextFile(
    planPath,
    JSON.stringify(resolutions, null, 2) + "\n",
    { createNew: true },
  );
  console.log(
    `Planned ${checks.length} checks for ${
      new Set(resolutions.map((item) => item.version)).size
    } distinct SDK version(s).`,
  );
} else {
  const resolutions: SdkResolution[] = JSON.parse(
    await Deno.readTextFile(planPath),
  );
  const checks = compatibilityChecks(resolutions, directory);
  if (phase === "summary") {
    const result = await summarize(checks, resolutions, directory);
    console.log(result.markdown);
    await Deno.writeTextFile(resolve(directory, "summary.md"), result.markdown);
    const summaryPath = Deno.env.get("GITHUB_STEP_SUMMARY");
    if (summaryPath) {
      await Deno.writeTextFile(summaryPath, result.markdown, { append: true });
    }
    if (!result.passed) Deno.exitCode = 1;
  } else {
    const selected = checks.filter((check) => check.phase === phase);
    if (!selected.length) {
      throw new Error(`Unknown compatibility phase: ${phase}`);
    }
    let node: string | undefined;
    if (selected.some((check) => check.node)) {
      const version = await new Deno.Command("node", { args: ["--version"] })
        .output();
      if (!version.success) {
        throw new Error("Could not identify the Node runtime");
      }
      node = new TextDecoder().decode(version.stdout).trim().replace(/^v/, "");
    }
    verifyRuntime(selected, Deno.version.deno, node);
    if (!await runChecks(selected, directory)) Deno.exitCode = 1;
  }
}
