import * as bdd from "@std/testing/bdd";
import {
  type RecordedTests,
  TestRecorder,
} from "@colibri/test-tooling/recorder/deno";

/** One configuration shared by every package test; the CLI supplies the run directory. */
export const recorder = new TestRecorder({
  capture: "details",
  authorization: { level: "full", signatures: false },
  profiling: { timings: true, resources: true, fees: true },
  output: {
    json: { directory: "./artifacts/colibri" },
    html: true,
    summary: true,
  },
});

/** Direct `deno test` remains usable without artifact permissions or collection overhead. */
export function recordColibriTests(file: string): RecordedTests {
  let enabled = false;
  try {
    enabled = Boolean(Deno.env.get("COLIBRI_RECORDER_DIRECTORY"));
  } catch {
    // Restricted tooling tests may deliberately deny environment access.
  }
  if (enabled) return recorder.recordTests(file);
  return {
    ...bdd,
    observer: {
      file,
      create: (factory) => factory(),
      attach: (target) => target,
      capture: (callback) => callback(),
      log: () => {},
      flush: () => Promise.resolve(),
    },
  };
}
