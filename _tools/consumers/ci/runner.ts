/** Record every compatibility case and fail the consolidated check on failures or omissions. */
import { resolve } from "node:path";
import type { Check, SdkResolution } from "./plan.ts";

export type Result = { id: string; code: number; seconds: number };
export type Execution = { code: number; stdout: string; stderr: string };

export async function execute(check: Check): Promise<Execution> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: check.args,
    env: check.env,
  }).output();
  const decode = new TextDecoder();
  return {
    code: output.code,
    stdout: decode.decode(output.stdout),
    stderr: decode.decode(output.stderr),
  };
}

/** Run isolated cases with bounded concurrency, retaining every result after failures. */
export async function runChecks(
  checks: readonly Check[],
  directory: string,
  run: (check: Check) => Promise<Execution> = execute,
  concurrency = 1,
): Promise<boolean> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Compatibility concurrency must be a positive integer");
  }
  await Deno.mkdir(resolve(directory, "results"), { recursive: true });
  await Deno.mkdir(resolve(directory, "logs"), { recursive: true });
  let passed = true;
  async function runOne(check: Check): Promise<void> {
    const start = performance.now();
    let output: Execution;
    try {
      output = await run(check);
    } catch (cause) {
      output = { code: 1, stdout: "", stderr: String(cause) };
    }
    const result: Result = {
      id: check.id,
      code: output.code,
      seconds: (performance.now() - start) / 1000,
    };
    await Deno.writeTextFile(
      resolve(directory, "logs", `${check.id}.log`),
      `${output.stdout}\n${output.stderr}`,
    );
    await Deno.writeTextFile(
      resolve(directory, "results", `${check.id}.json`),
      JSON.stringify(result, null, 2) + "\n",
    );
    // Print each completed case as one group so parallel output cannot interleave.
    console.log(`::group::${check.label}`);
    console.log(output.stdout);
    if (output.stderr) console.error(output.stderr);
    console.log(
      `${output.code === 0 ? "PASS" : "FAIL"}: ${check.label} (${
        result.seconds.toFixed(1)
      }s)`,
    );
    console.log("::endgroup::");
    passed &&= output.code === 0;
  }
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, checks.length) }, async () => {
      while (next < checks.length) await runOne(checks[next++]);
    }),
  );
  return passed;
}

/** Missing, corrupt or mismatched records are failures, never skipped successes. */
export async function summarize(
  checks: readonly Check[],
  resolutions: readonly SdkResolution[],
  directory: string,
): Promise<{ passed: boolean; markdown: string }> {
  const rows: string[] = [];
  let passed = true;
  for (const check of checks) {
    let result: Result | undefined;
    try {
      const data = JSON.parse(
        await Deno.readTextFile(
          resolve(directory, "results", `${check.id}.json`),
        ),
      );
      if (
        data.id === check.id && Number.isInteger(data.code) &&
        Number.isFinite(data.seconds) && data.seconds >= 0
      ) result = data;
    } catch { /* Report unavailable evidence as missing below. */ }
    const status = !result ? "MISSING" : result.code === 0 ? "PASS" : "FAIL";
    passed &&= status === "PASS";
    rows.push(
      `| ${check.label} | ${status} | ${
        result ? `${result.seconds.toFixed(1)}s` : "—"
      } |`,
    );
  }
  return {
    passed,
    markdown: `## Consumer compatibility\n\n${
      resolutions.map((item) =>
        `- SDK \`${item.selection}\` resolved to \`${item.version}\`.`
      ).join("\n")
    }\n\nIdentical resolved SDK versions share one set of checks. Every distinct runtime/compiler combination is retained. Durations are per case and overlap when cases run concurrently.\n\n| Check | Result | Duration |\n| --- | --- | --- |\n${
      rows.join("\n")
    }\n`,
  };
}
