import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { projectFiles } from "archunit";
import {
  assertRule,
  CONFIG_DIRECTORY,
  CORE_CONFIG,
  PACKAGE_ARCHITECTURES,
  type PackageArchitecture,
} from "colibri-tools/architecture/shared.ts";

type CycleEdge = {
  sourceLabel: string;
  targetLabel: string;
};

type CycleViolation = {
  cycle?: CycleEdge[];
};

const canonicalCycle = (violation: CycleViolation): string =>
  (violation.cycle ?? [])
    .map(({ sourceLabel, targetLabel }) => `${sourceLabel}->${targetLabel}`)
    .sort()
    .join("|");

const assertNoUnexpectedCycles = async (
  architecture: PackageArchitecture,
  knownCycles: readonly string[],
): Promise<void> => {
  const violations = await projectFiles(architecture.config)
    .inPath(architecture.source)
    .should()
    .haveNoCycles()
    .check() as CycleViolation[];
  const unexpected = violations
    .map(canonicalCycle)
    .filter((cycle) => !knownCycles.includes(cycle));

  assertEquals(
    unexpected,
    [],
    `${architecture.name} introduced an unapproved circular dependency`,
  );
};

describe("dependency cycles", () => {
  it("keeps complete package graphs free of new cycles", async () => {
    const cycleFreePackages = PACKAGE_ARCHITECTURES.filter(({ root }) =>
      root !== "core" && root !== "rpc-streamer" && root !== "webauth"
    );
    for (const architecture of cycleFreePackages) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .haveNoCycles(),
        `${architecture.name} must remain cycle-free`,
      );
    }
  });

  it("permits only the two established RPC Streamer factory cycles", async () => {
    const root = "../../../rpc-streamer/src";
    await assertNoUnexpectedCycles(PACKAGE_ARCHITECTURES[3], [
      `${root}/streamer.ts->${root}/variants/event/index.ts|${root}/variants/event/index.ts->${root}/streamer.ts`,
      `${root}/streamer.ts->${root}/variants/ledger/index.ts|${root}/variants/ledger/index.ts->${root}/streamer.ts`,
    ]);
  });

  it("permits only the established WebAuth type and error cycles", async () => {
    const root = "../../../webauth/src";
    await assertNoUnexpectedCycles(PACKAGE_ARCHITECTURES[4], [
      `${root}/error.ts->${root}/types.ts|${root}/sep45/codec.ts->${root}/error.ts|${root}/sep45/contract-auth.ts->${root}/sep45/codec.ts|${root}/types.ts->${root}/sep45/contract-auth.ts`,
      `${root}/sep45/contract-auth.ts->${root}/types.ts|${root}/types.ts->${root}/sep45/contract-auth.ts`,
    ]);
  });

  it("keeps every independently evolving Core region cycle-free", async () => {
    const coreRegions = [
      "account",
      "address",
      "asset",
      "auth",
      "common",
      "contract",
      "error",
      "event",
      "ledger-entries",
      "network",
      "pipelines",
      "plugins",
      "processes",
      "sep1",
      "signer",
      "steps",
      "strkeys",
      "toid",
      "tools",
    ];

    for (const region of coreRegions) {
      await assertRule(
        projectFiles(CORE_CONFIG)
          .inPath(`../../../core/${region}/**/*.ts`)
          .should()
          .haveNoCycles(),
        `core/${region} must remain cycle-free`,
      );
    }

    for (const region of ["operation", "transaction", "ledger"]) {
      await assertRule(
        projectFiles(CORE_CONFIG)
          .inPath(`../../../core/ledger-parser/${region}/**/*.ts`)
          .should()
          .haveNoCycles(),
        `core/ledger-parser/${region} must remain cycle-free`,
      );
    }
  });

  it("keeps protocol variants internally cycle-free", async () => {
    const scopes = [
      {
        config: `${CONFIG_DIRECTORY}/rpc-streamer.json`,
        source: "../../../rpc-streamer/src/variants/event/**/*.ts",
      },
      {
        config: `${CONFIG_DIRECTORY}/rpc-streamer.json`,
        source: "../../../rpc-streamer/src/variants/ledger/**/*.ts",
      },
      {
        config: `${CONFIG_DIRECTORY}/webauth.json`,
        source: "../../../webauth/src/sep10/**/*.ts",
      },
      {
        config: `${CONFIG_DIRECTORY}/webauth.json`,
        source: "../../../webauth/src/sep45/**/*.ts",
      },
    ];

    for (const scope of scopes) {
      await assertRule(
        projectFiles(scope.config)
          .inPath(scope.source)
          .should()
          .haveNoCycles(),
        `${scope.source} must remain internally cycle-free`,
      );
    }
  });
});
