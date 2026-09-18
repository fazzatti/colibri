import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { RecorderOptions } from "@/recorder/types.ts";
import { aggregate, type RunManifest } from "@/recorder/deno/aggregate.ts";
import { summarize } from "@/recorder/report/aggregate.ts";
import * as ERROR from "@/recorder/error.ts";

/** Launch Deno, then aggregate even when it fails. Child output remains unmodified. */
export async function runTests(
  config: string,
  args: string[],
): Promise<number> {
  const imported = await import(pathToFileURL(resolve(config)).href);
  const options: RecorderOptions | undefined = imported.recorder?.options;
  if (!options) {
    throw new ERROR.INVALID_CONFIGURATION(
      "Configuration must export a TestRecorder named recorder.",
    );
  }
  if (args.some((arg) => arg.startsWith("--junit-path"))) {
    throw new ERROR.INVALID_CONFIGURATION(
      "The recorder owns --junit-path; remove it from child arguments.",
    );
  }
  const runId = crypto.randomUUID();
  const root = options.output?.json?.directory;
  const retained = Boolean(root || options.output?.html);
  const directory = retained
    ? resolve(root ?? "artifacts/colibri", runId)
    : await Deno.makeTempDir({ prefix: "colibri-recorder-" });
  await Deno.mkdir(join(directory, "fragments"), { recursive: true });
  const manifest: RunManifest = {
    schemaVersion: 1,
    runId,
    cwd: Deno.cwd(),
    startedAt: new Date().toISOString(),
    html: options.output?.html,
  };
  const writeManifest = () =>
    Deno.writeTextFile(
      join(directory, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  let exitCode = 1;
  try {
    await writeManifest();
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        "test",
        `--junit-path=${join(directory, "runner.junit.xml")}`,
        ...args,
      ],
      env: {
        COLIBRI_RECORDER_RUN_ID: runId,
        COLIBRI_RECORDER_DIRECTORY: directory,
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    exitCode = (await child.status).code;
    manifest.exitCode = exitCode;
    manifest.endedAt = new Date().toISOString();
    await writeManifest();
    const report = await aggregate(directory);
    if (options.output?.summary) {
      console.log("Colibri evidence:", summarize(report));
    }
    if (retained) {
      console.log(
        `Colibri report: ${
          join(directory, options.output?.html ? "report.html" : "report.json")
        }`,
      );
    }
    return exitCode;
  } catch (error) {
    console.error("Recorder run failed:", error);
    return exitCode || 1;
  } finally {
    if (!retained) await Deno.remove(directory, { recursive: true });
  }
}
