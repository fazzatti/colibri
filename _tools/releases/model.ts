/** Reviewed release intent, independent of Git, publication, and commit subjects. */
import {
  format,
  increment,
  parse,
  parseRange,
  satisfies,
} from "jsr:@std/semver@1.0.5";

export type Bump = "patch" | "minor" | "major";
export type ReleaseIntent = {
  bump: Bump | "initial";
  initialVersion?: string;
  reason: string;
  apiReview?: string;
  dependencies?: Record<string, string>;
};
export type ReleasePlan = {
  schema: 1;
  base: string;
  packages: Record<string, ReleaseIntent>;
};
export type PackageState = {
  name: string;
  root: string;
  version: string;
  previousVersion: string | null;
  dependencies: Record<string, string>;
  changed: boolean;
};
export type PlannedRelease = PackageState & {
  targetVersion: string;
  intent?: ReleaseIntent;
  targetDependencies: Record<string, string>;
};

export function readPlan(text: string): ReleasePlan {
  const plan = JSON.parse(text);
  if (
    plan?.schema !== 1 || !/^[a-f0-9]{40}$/.test(plan.base ?? "") ||
    !plan.packages || Array.isArray(plan.packages) ||
    typeof plan.packages !== "object"
  ) {
    throw new Error(
      "RELEASE_INVALID_PLAN: expected schema 1, a full base commit, and package intents",
    );
  }
  for (const [name, value] of Object.entries(plan.packages)) {
    const intent = value as ReleaseIntent;
    if (
      !intent ||
      !["patch", "minor", "major", "initial"].includes(intent.bump) ||
      typeof intent.reason !== "string" || !intent.reason.trim()
    ) {
      throw new Error(
        `RELEASE_INVALID_INTENT: ${name} needs a reviewed bump and reason`,
      );
    }
    if (intent.bump === "initial") {
      if (
        !intent.initialVersion ||
        format(parse(intent.initialVersion)) !== intent.initialVersion
      ) throw new Error(`RELEASE_INVALID_INITIAL_VERSION: ${name}`);
    } else if (intent.initialVersion !== undefined) {
      throw new Error(`RELEASE_UNEXPECTED_INITIAL_VERSION: ${name}`);
    }
    if (
      intent.apiReview !== undefined &&
      (typeof intent.apiReview !== "string" || !intent.apiReview.trim())
    ) {
      throw new Error(`RELEASE_INVALID_API_REVIEW: ${name}`);
    }
    if (
      intent.dependencies !== undefined &&
      (!intent.dependencies || Array.isArray(intent.dependencies) ||
        typeof intent.dependencies !== "object")
    ) {
      throw new Error(`RELEASE_INVALID_DEPENDENCIES: ${name}`);
    }
    for (const range of Object.values(intent.dependencies ?? {})) {
      parseRange(range);
    }
  }
  return plan;
}

export function accepts(version: string, range: string): boolean {
  return satisfies(parse(version), parseRange(range));
}

/** Always increment the released baseline, never the already-edited manifest. */
export function planReleases(
  packages: readonly PackageState[],
  plan: ReleasePlan,
): PlannedRelease[] {
  const names = new Set(packages.map((pkg) => pkg.name));
  for (const name of Object.keys(plan.packages)) {
    if (!names.has(name)) throw new Error(`RELEASE_UNKNOWN_PACKAGE: ${name}`);
  }
  const releases = packages.map((pkg) => {
    const intent = plan.packages[pkg.name];
    if (pkg.changed && !intent) {
      throw new Error(
        `RELEASE_MISSING_INTENT: published changes in ${pkg.name}`,
      );
    }
    if (
      pkg.previousVersion === null &&
      (intent?.bump !== "initial" || !intent.initialVersion)
    ) throw new Error(`RELEASE_INITIAL_INTENT_REQUIRED: ${pkg.name}`);
    if (pkg.previousVersion !== null && intent?.bump === "initial") {
      throw new Error(`RELEASE_ALREADY_PUBLISHED: ${pkg.name}`);
    }
    const targetVersion = intent?.bump === "initial"
      ? intent.initialVersion!
      : intent
      ? format(increment(parse(pkg.previousVersion!), intent.bump))
      : pkg.previousVersion!;
    for (const dependency of Object.keys(intent?.dependencies ?? {})) {
      if (!(dependency in pkg.dependencies)) {
        throw new Error(
          `RELEASE_UNKNOWN_DEPENDENCY: ${pkg.name} -> ${dependency}`,
        );
      }
    }
    return {
      ...pkg,
      intent,
      targetVersion,
      targetDependencies: { ...pkg.dependencies, ...intent?.dependencies },
    };
  });
  for (const pkg of releases) {
    for (const [dependency, range] of Object.entries(pkg.targetDependencies)) {
      const target = releases.find((item) => item.name === dependency);
      if (target && !accepts(target.targetVersion, range)) {
        throw new Error(
          `RELEASE_DEPENDENCY_RANGE: ${pkg.name} requires ${dependency}@${range}, not ${target.targetVersion}; review its release intent and minimum dependency`,
        );
      }
    }
  }
  return releases;
}

export function assertApplied(releases: readonly PlannedRelease[]): void {
  for (const pkg of releases) {
    if (pkg.version !== pkg.targetVersion) {
      throw new Error(
        `RELEASE_VERSION_MISMATCH: ${pkg.name} expected ${pkg.targetVersion}, found ${pkg.version}`,
      );
    }
    for (const [name, range] of Object.entries(pkg.targetDependencies)) {
      if (pkg.dependencies[name] !== range) {
        throw new Error(
          `RELEASE_DEPENDENCY_NOT_APPLIED: ${pkg.name} -> ${name}@${range}`,
        );
      }
    }
  }
}
