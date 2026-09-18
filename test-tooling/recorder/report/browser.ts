import { modelScript } from "@/recorder/report/browser/model.ts";
import { measurementsScript } from "@/recorder/report/browser/measurements.ts";
import { summaryScript } from "@/recorder/report/browser/summary.ts";
import { evidenceScript } from "@/recorder/report/browser/evidence.ts";
import { profilingScript } from "@/recorder/report/browser/profiling.ts";
import { appScript } from "@/recorder/report/browser/app.ts";

/** Inline browser modules keep a report portable under file:// without a server. */
export const browserScript: string = [
  modelScript,
  measurementsScript,
  summaryScript,
  evidenceScript,
  profilingScript,
  appScript,
].join("\n");
