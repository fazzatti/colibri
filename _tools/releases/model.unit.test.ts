import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  accepts,
  assertApplied,
  type PackageState,
  planReleases,
  readPlan,
  type ReleaseIntent,
  type ReleasePlan,
} from "./model.ts";
import { colibriDependencies } from "./repository.ts";

const base = "a".repeat(40);
const core: PackageState = {
  name: "@colibri/core",
  root: "core",
  version: "1.0.0",
  previousVersion: "1.0.0",
  dependencies: {},
  changed: false,
};
const plugin: PackageState = {
  ...core,
  name: "@colibri/plugin",
  root: "plugins/example",
  dependencies: { "@colibri/core": "^1.0.0" },
};
const intent = (bump: ReleaseIntent["bump"]): ReleaseIntent => ({
  bump,
  reason: "Reviewed compatibility decision",
});
const plan = (packages: ReleasePlan["packages"]): ReleasePlan => ({
  schema: 1,
  base,
  packages,
});

describe("reviewed release planning", () => {
  it("parses explicit intents including API review and dependency floors", () => {
    const value = plan({
      [plugin.name]: {
        ...intent("minor"),
        apiReview: "New optional method",
        dependencies: { [core.name]: "^1.1.0" },
      },
    });
    assertEquals(readPlan(JSON.stringify(value)), value);
  });

  for (
    const invalid of [null, {}, { schema: 2, base, packages: {} }, {
      schema: 1,
      base: "main",
      packages: {},
    }, { schema: 1, base, packages: [] }]
  ) {
    it(`rejects malformed plans: ${JSON.stringify(invalid)}`, () => {
      assertThrows(
        () => readPlan(JSON.stringify(invalid)),
        Error,
        "RELEASE_INVALID_PLAN",
      );
    });
  }
  for (
    const invalid of [null, {}, { bump: "prerelease", reason: "why" }, {
      bump: "patch",
      reason: " ",
    }]
  ) {
    it(`rejects unreviewed intent: ${JSON.stringify(invalid)}`, () => {
      assertThrows(
        () =>
          readPlan(
            JSON.stringify({ schema: 1, base, packages: { core: invalid } }),
          ),
        Error,
        "RELEASE_INVALID_INTENT",
      );
    });
  }
  it("rejects empty API reviews and malformed dependency decisions", () => {
    for (const apiReview of [" ", 5]) {
      assertThrows(
        () =>
          readPlan(
            JSON.stringify(
              plan({
                [core.name]: { ...intent("patch"), apiReview } as ReleaseIntent,
              }),
            ),
          ),
        Error,
        "RELEASE_INVALID_API_REVIEW",
      );
    }
    for (const dependencies of [null, [], 3]) {
      assertThrows(
        () =>
          readPlan(
            JSON.stringify({
              schema: 1,
              base,
              packages: { core: { ...intent("patch"), dependencies } },
            }),
          ),
        Error,
        "RELEASE_INVALID_DEPENDENCIES",
      );
    }
    assertThrows(() =>
      readPlan(
        JSON.stringify(
          plan({
            [core.name]: {
              ...intent("patch"),
              dependencies: { core: "not-semver" },
            },
          }),
        ),
      )
    );
  });

  it("preserves unchanged packages and compatible older dependency floors", () => {
    const releases = planReleases(
      [core, plugin],
      plan({ [core.name]: intent("minor") }),
    );
    assertEquals(releases.map((pkg) => pkg.targetVersion), ["1.1.0", "1.0.0"]);
    assertEquals(releases[1].targetDependencies, { [core.name]: "^1.0.0" });
  });
  it("computes one cumulative bump from baseline even when manifests are already edited", () => {
    for (
      const [bump, expected] of [["patch", "1.0.1"], ["minor", "1.1.0"], [
        "major",
        "2.0.0",
      ]] as const
    ) {
      const value = planReleases([{
        ...core,
        version: expected,
        changed: true,
      }], plan({ [core.name]: intent(bump) }));
      assertEquals(value[0].targetVersion, expected);
      assertApplied(value);
    }
  });
  it("graduates a zero-major package to exactly 1.0.0", () => {
    assertEquals(
      planReleases(
        [{ ...core, previousVersion: "0.30.1" }],
        plan({ [core.name]: intent("major") }),
      )[0].targetVersion,
      "1.0.0",
    );
  });
  it("requires explicit intent for changed packages and rejects misspelled package names", () => {
    assertThrows(
      () => planReleases([{ ...core, changed: true }], plan({})),
      Error,
      "RELEASE_MISSING_INTENT",
    );
    assertThrows(
      () => planReleases([core], plan({ typo: intent("patch") })),
      Error,
      "RELEASE_UNKNOWN_PACKAGE",
    );
  });
  it("does not silently migrate a dependent to a new Core major", () => {
    assertThrows(
      () =>
        planReleases([core, plugin], plan({ [core.name]: intent("major") })),
      Error,
      "RELEASE_DEPENDENCY_RANGE",
    );
  });
  it("accepts explicitly reviewed dependent adoption and required minimum floors", () => {
    const releases = planReleases(
      [core, plugin],
      plan({
        [core.name]: intent("major"),
        [plugin.name]: {
          ...intent("major"),
          dependencies: { [core.name]: "^2.0.0" },
        },
      }),
    );
    assertEquals(releases[1].targetDependencies, { [core.name]: "^2.0.0" });
    assertThrows(
      () => assertApplied(releases),
      Error,
      "RELEASE_VERSION_MISMATCH",
    );
    assertThrows(
      () =>
        assertApplied(
          releases.map((pkg) => ({ ...pkg, version: pkg.targetVersion })),
        ),
      Error,
      "RELEASE_DEPENDENCY_NOT_APPLIED",
    );
    assertApplied(
      releases.map((pkg) => ({
        ...pkg,
        version: pkg.targetVersion,
        dependencies: pkg.targetDependencies,
      })),
    );
  });
  it("rejects dependency typos, not packages outside this workspace", () => {
    assertThrows(
      () =>
        planReleases(
          [core],
          plan({
            [core.name]: {
              ...intent("patch"),
              dependencies: { unknown: "^1.0.0" },
            },
          }),
        ),
      Error,
      "RELEASE_UNKNOWN_DEPENDENCY",
    );
    assertApplied(
      planReleases([{
        ...core,
        dependencies: { "@colibri/external": "^1.0.0" },
      }], plan({})),
    );
  });
  it("uses semantic ranges rather than literal substitutions", () => {
    assertEquals(accepts("1.2.0", "^1.0.0"), true);
    assertEquals(accepts("2.0.0", "^1.0.0"), false);
    assertEquals(accepts("0.31.0", "^0.30.1"), false);
    assertEquals(accepts("1.2.0", ">=1.0.0 <2"), true);
  });
  it("discovers declared Colibri dependencies but ignores local and external aliases", () => {
    assertEquals(colibriDependencies({}), {});
    assertEquals(
      colibriDependencies({
        imports: {
          core: "jsr:@colibri/core@^1.0.0",
          local: "./mod.ts",
          sdk: "npm:@stellar/stellar-sdk@^17.0.1",
        },
      }),
      { "@colibri/core": "^1.0.0" },
    );
  });
});

describe("initial package releases", () => {
  const initial = {
    ...core,
    name: "@colibri/new",
    version: "0.1.0",
    previousVersion: null,
    changed: true,
  };
  it("requires an explicit initial version and never increments it", () => {
    const releasePlan = plan({
      [initial.name]: {
        bump: "initial",
        initialVersion: "0.1.0",
        reason: "New preview package",
      },
    });
    const parsed = readPlan(JSON.stringify(releasePlan));
    assertEquals(planReleases([initial], parsed)[0].targetVersion, "0.1.0");
    assertApplied(planReleases([initial], parsed));
    assertThrows(
      () => planReleases([initial], plan({ [initial.name]: intent("minor") })),
      Error,
      "INITIAL_INTENT_REQUIRED",
    );
    assertThrows(
      () => planReleases([{ ...initial, previousVersion: "0.0.1" }], parsed),
      Error,
      "ALREADY_PUBLISHED",
    );
    assertThrows(
      () =>
        readPlan(JSON.stringify(plan({ [initial.name]: intent("initial") }))),
      Error,
    );
    assertThrows(
      () =>
        readPlan(
          JSON.stringify(
            plan({
              [initial.name]: { ...intent("minor"), initialVersion: "0.1.0" },
            }),
          ),
        ),
      Error,
    );
  });
});
