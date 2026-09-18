import { TestRecorder } from "@colibri/test-tooling/recorder/deno";

/** Shared configuration for the offline report demonstration. */
export const recorder = new TestRecorder({
  capture: "trace",
  authorization: { level: "full", signatures: false },
  profiling: { timings: true, resources: true, fees: true },
  output: {
    json: { directory: "./artifacts/colibri" },
    html: true,
    summary: true,
  },
});
