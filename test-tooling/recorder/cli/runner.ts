import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import process from "node:process";
import { spawn } from "node:child_process";
import type { RecorderOptions } from "@/recorder/types.ts";
import { aggregate, type RunManifest } from "@/recorder/artifacts/aggregate.ts";
import { summarize } from "@/recorder/report/aggregate.ts";
import {
  cleanupReporter,
  nativeArguments,
  nativeRunner,
  runtime,
} from "@/recorder/cli/native-runner.ts";
import * as ERROR from "@/recorder/error.ts";

/** Launch the native runner, then aggregate even when tests fail. Child output remains visible. */
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
  // Validate before creating any output directory.
  nativeArguments(runtime, args, ".");
  const runId = crypto.randomUUID();
  const root = options.output?.json?.directory;
  const retained = Boolean(root || options.output?.html);
  const directory = retained
    ? resolve(root ?? "artifacts/colibri", runId)
    : await mkdtemp(join(tmpdir(), "colibri-recorder-"));
  const manifest: RunManifest = {
    schemaVersion: 1,
    runId,
    cwd: process.cwd(),
    startedAt: new Date().toISOString(),
    html: options.output?.html,
    runtime,
  };
  const writeManifest = () =>
    writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
  let exitCode = 1;
  try {
    await mkdir(join(directory, "fragments"), { recursive: true });
    await writeManifest();
    await nativeRunner.prepare(directory);
    exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        nativeArguments(runtime, args, directory),
        {
          env: {
            ...process.env,
            COLIBRI_RECORDER_RUN_ID: runId,
            COLIBRI_RECORDER_DIRECTORY: directory,
          },
          stdio: "inherit",
        },
      );
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 1));
    });
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
    await cleanupReporter(directory);
    if (!retained) await rm(directory, { recursive: true, force: true });
  }
}
