/** The supported compatibility combinations, independent of GitHub job fan-out. */
import { resolve } from "node:path";
import { accepts } from "../../releases/model.ts";

export const sdkSelections = ["17.0.1", "^17.0.1"] as const;
export const nodeVersions = ["22.12.0", "22", "24"] as const;
export const denoVersions = ["2.7.11", "2.9.6"] as const;
export const typescriptVersions = ["5.9.3", "6.0.3"] as const;

export type SdkResolution = { selection: string; version: string };
export type Check = {
  id: string;
  phase: string;
  label: string;
  args: string[];
  env: Record<string, string>;
  deno: string;
  node?: string;
};

/** Resolve both policies before deduplicating; a newer compatible SDK keeps its full matrix. */
export function sdkTargets(resolutions: readonly SdkResolution[]): string[] {
  if (
    resolutions.length !== sdkSelections.length ||
    sdkSelections.some((selection) =>
      resolutions.filter((item) => item.selection === selection).length !== 1
    ) ||
    resolutions.some((item) =>
      !/^17\.\d+\.\d+$/.test(item.version) ||
      !accepts(item.version, item.selection)
    ) ||
    resolutions.find((item) => item.selection === "17.0.1")?.version !==
      "17.0.1"
  ) throw new Error("Invalid SDK resolution plan");
  return [...new Set(resolutions.map((item) => item.version))];
}

/** Every case is retained in the final summary, including preparation and browser diagnostics. */
export function compatibilityChecks(
  resolutions: readonly SdkResolution[],
  directory: string,
): Check[] {
  const checks: Check[] = [];
  const add = ({
    phase,
    label,
    args,
    sdk,
    typescript,
    node,
    deno = "2.9.6",
  }: Pick<Check, "phase" | "label" | "args" | "node"> & {
    sdk?: string;
    typescript?: string;
    deno?: string;
  }) =>
    checks.push({
      id: [phase, sdk, typescript].filter(Boolean).join("-"),
      phase,
      label,
      args: ["task", ...args],
      env: {
        ...(sdk ? { STELLAR_SDK_VERSION: sdk } : {}),
        ...(typescript ? { TYPESCRIPT_VERSION: typescript } : {}),
      },
      deno,
      node,
    });
  for (const sdk of sdkTargets(resolutions)) {
    const artifacts = resolve(directory, `sdk-${sdk}`);
    add({
      phase: "prepare",
      label: `Prepare SDK ${sdk}`,
      args: ["prepare:consumers", artifacts],
      sdk,
      node: "24",
    });
    add({
      phase: "dependencies",
      label: `Released Core ranges / SDK ${sdk}`,
      args: ["check:consumers:dependencies"],
      sdk,
    });
    for (const deno of denoVersions) {
      add({
        phase: `deno-${deno}`,
        label: `Deno ${deno} / SDK ${sdk}`,
        args: ["check:consumers:deno"],
        sdk,
        deno,
      });
    }
    for (const node of nodeVersions) {
      for (const typescript of typescriptVersions) {
        add({
          phase: `node-${node}`,
          label: `Node ${node} / TS ${typescript} / SDK ${sdk}`,
          args: ["check:consumers:npm", artifacts],
          sdk,
          typescript,
          node,
        });
      }
    }
    add({
      phase: "browsers",
      label: `Chromium, Firefox, WebKit / SDK ${sdk}`,
      args: ["check:consumers:npm", artifacts, "--browsers"],
      sdk,
      typescript: "6.0.3",
      node: "24",
    });
  }
  add({
    phase: "bundles",
    label: "Production bundle metrics",
    args: ["test:bundle-tooling"],
    node: "24",
  });
  add({
    phase: "bundles",
    label: "Production bundle budgets and browser execution",
    args: [
      "check:bundles",
      resolve(directory, "bundles"),
      resolve(directory, "sdk-17.0.1"),
    ],
    sdk: "17.0.1",
    node: "24",
  });
  add({
    phase: "browser-runner",
    label: "Browser failure diagnostics and cleanup",
    args: ["test:browser-runner"],
    node: "24",
  });
  return checks;
}

/** Prevent an installed runtime mismatch from silently standing in for a requested version. */
export function verifyRuntime(
  checks: readonly Check[],
  deno: string,
  node?: string,
): void {
  for (const check of checks) {
    if (
      deno !== check.deno || (check.node &&
        !(check.node.includes(".")
          ? node === check.node
          : node?.startsWith(`${check.node}.`)))
    ) {
      throw new Error(
        `Runtime mismatch for ${check.label}: Deno ${deno}, Node ${node}`,
      );
    }
  }
}
