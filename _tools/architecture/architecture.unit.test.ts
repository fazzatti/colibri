import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { projectFiles } from "archunit";

type ArchitectureRule = {
  check(): Promise<unknown[]>;
};

type PackageArchitecture = {
  config: string;
  source: string;
};

const CONFIG_DIRECTORY = "_tools/architecture/config";
const CORE_CONFIG = `${CONFIG_DIRECTORY}/core.json`;
const PACKAGE_ARCHITECTURES: PackageArchitecture[] = [
  { config: CORE_CONFIG, source: "../../../core/**/*.ts" },
  {
    config: `${CONFIG_DIRECTORY}/build-verification.json`,
    source: "../../../build-verification/**/*.ts",
  },
  {
    config: `${CONFIG_DIRECTORY}/identicon.json`,
    source: "../../../identicon/**/*.ts",
  },
  {
    config: `${CONFIG_DIRECTORY}/rpc-streamer.json`,
    source: "../../../rpc-streamer/**/*.ts",
  },
  {
    config: `${CONFIG_DIRECTORY}/webauth.json`,
    source: "../../../webauth/**/*.ts",
  },
  {
    config: `${CONFIG_DIRECTORY}/plugin-fee-bump.json`,
    source: "../../../plugins/fee-bump/**/*.ts",
  },
  {
    config: `${CONFIG_DIRECTORY}/plugin-channel-accounts.json`,
    source: "../../../plugins/channel-accounts/**/*.ts",
  },
  {
    config: `${CONFIG_DIRECTORY}/test-tooling.json`,
    source: "../../../test-tooling/**/*.ts",
  },
];

const assertRule = async (
  rule: ArchitectureRule,
  description: string,
): Promise<void> => {
  const violations = await rule.check();
  assertEquals(violations, [], description);
};

const PRIVATE_REPOSITORY_IMPORT =
  /(?:from\s*|import\s*\()\s*["'](?:colibri-internal|colibri-tools)\//;
const TEST_MODULE_IMPORT =
  /(?:from\s*|import\s*\()\s*["'][^"']+\.(?:unit\.|integration\.|testnet\.integration\.)?test\.ts["']/;
const PUBLIC_ENTRYPOINT_IMPORT =
  /(?:from\s*|import\s*\()\s*["'][^"']*\/mod\.ts["']/;

describe("workspace architecture", () => {
  it("keeps each architectural region free of circular dependencies", async () => {
    const cycleScopes: PackageArchitecture[] = [
      PACKAGE_ARCHITECTURES[1],
      PACKAGE_ARCHITECTURES[2],
      PACKAGE_ARCHITECTURES[5],
      PACKAGE_ARCHITECTURES[6],
      PACKAGE_ARCHITECTURES[7],
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
      { config: CORE_CONFIG, source: "../../../core/common/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/processes/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/steps/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/pipelines/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/plugins/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/contract/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/asset/**/*.ts" },
      { config: CORE_CONFIG, source: "../../../core/event/**/*.ts" },
      {
        config: CORE_CONFIG,
        source: "../../../core/ledger-parser/operation/**/*.ts",
      },
      {
        config: CORE_CONFIG,
        source: "../../../core/ledger-parser/transaction/**/*.ts",
      },
      {
        config: CORE_CONFIG,
        source: "../../../core/ledger-parser/ledger/**/*.ts",
      },
    ];

    for (const scope of cycleScopes) {
      await assertRule(
        projectFiles(scope.config)
          .inPath(scope.source)
          .should()
          .haveNoCycles(),
        `${scope.source} must remain cycle-free`,
      );
    }
  });

  it("keeps Core layers pointing toward lower-level abstractions", async () => {
    const forbiddenDependencies = [
      {
        source: "../../../core/processes/**/*.ts",
        target: "../../../core/{steps,pipelines,plugins}/**/*.ts",
      },
      {
        source: "../../../core/steps/**/*.ts",
        target: "../../../core/{pipelines,plugins}/**/*.ts",
      },
      {
        source: "../../../core/pipelines/shared/**/*.ts",
        target:
          "../../../core/pipelines/{classic-transaction,invoke-contract,read-from-contract}/**/*.ts",
      },
    ];

    for (const boundary of forbiddenDependencies) {
      await assertRule(
        projectFiles(CORE_CONFIG)
          .inPath(boundary.source)
          .shouldNot()
          .dependOnFiles()
          .inPath(boundary.target),
        `${boundary.source} must not depend on ${boundary.target}`,
      );
    }
  });

  it("keeps repository-only modules out of published runtime code", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) => !PRIVATE_REPOSITORY_IMPORT.test(file.content),
            "Published runtime code must not import _internal or _tools modules",
          ),
        `${architecture.source} must be independent from repository-only modules`,
      );
    }
  });

  it("keeps tests and public barrels out of runtime dependency paths", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) =>
              !TEST_MODULE_IMPORT.test(file.content) &&
              !PUBLIC_ENTRYPOINT_IMPORT.test(file.content),
            "Runtime modules must not depend on tests or public mod.ts barrels",
          ),
        `${architecture.source} must only depend on runtime internals`,
      );
    }
  });

  it("uses named exports throughout published runtime code", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) => !/\bexport\s+default\b/.test(file.content),
            "Published modules must use named exports",
          ),
        `${architecture.source} must not declare default exports`,
      );
    }
  });
});
