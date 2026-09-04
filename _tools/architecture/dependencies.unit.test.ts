import { describe, it } from "@std/testing/bdd";
import { projectFiles } from "archunit";
import {
  architectureFileContent,
  assertRule,
  CONFIG_DIRECTORY,
  CORE_CONFIG,
  PACKAGE_ARCHITECTURES,
  sourceWithoutComments,
} from "colibri-tools/architecture/shared.ts";

const PRIVATE_REPOSITORY_IMPORT =
  /(?:from\s*|import\s*\()\s*["'](?:colibri-internal|colibri-tools)\//;
const TEST_MODULE_IMPORT =
  /(?:from\s*|import\s*\()\s*["'][^"']+\.(?:unit\.|integration\.|testnet\.integration\.)?test\.ts["']/;
const PUBLIC_ENTRYPOINT_IMPORT =
  /(?:from\s*|import\s*\()\s*["'][^"']*\/mod\.ts["']/;
const COLIBRI_IMPORT =
  /(?:from\s*|import\s*\()\s*["'](?:jsr:)?(@colibri\/[a-z0-9-]+)(\/[^"']*)?["']/g;

const colibriImports = (
  source: string,
): Array<{ packageName: string; subpath?: string }> =>
  [...source.matchAll(COLIBRI_IMPORT)].map((match) => ({
    packageName: match[1],
    subpath: match[2],
  }));

describe("dependency direction", () => {
  it("keeps Core execution layers pointing inward", async () => {
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

  it("keeps build-verification's orchestration layers directional", async () => {
    const config = `${CONFIG_DIRECTORY}/build-verification.json`;
    const root = "../../../build-verification/src";
    const forbiddenDependencies = [
      {
        source: `${root}/core/**/*.ts`,
        target:
          `${root}/{processes,steps,pipelines,providers,runners,verifier,cli}/**/*.ts`,
      },
      {
        source:
          `${root}/{archive,artifacts,providers,reporting,runners}/**/*.ts`,
        target: `${root}/{processes,steps,pipelines,verifier,cli}/**/*.ts`,
      },
      {
        source: `${root}/processes/**/*.ts`,
        target: `${root}/{steps,pipelines,verifier,cli}/**/*.ts`,
      },
      {
        source: `${root}/steps/**/*.ts`,
        target: `${root}/{pipelines,verifier,cli}/**/*.ts`,
      },
      {
        source: `${root}/pipelines/**/*.ts`,
        target: `${root}/{verifier,cli}/**/*.ts`,
      },
      {
        source: `${root}/verifier/**/*.ts`,
        target: `${root}/cli/**/*.ts`,
      },
    ];

    for (const boundary of forbiddenDependencies) {
      await assertRule(
        projectFiles(config)
          .inPath(boundary.source)
          .shouldNot()
          .dependOnFiles()
          .inPath(boundary.target),
        `${boundary.source} must not depend on ${boundary.target}`,
      );
    }
  });

  it("allows workspace packages to depend only on Core", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) =>
              colibriImports(
                sourceWithoutComments(architectureFileContent(file)),
              ).every((
                { packageName },
              ) =>
                architecture.allowedColibriDependencies.includes(packageName)
              ),
            `${architecture.name} imports an unauthorized Colibri package`,
          ),
        `${architecture.name} must respect workspace package boundaries`,
      );
    }
  });

  it("uses only package roots when consuming another Colibri package", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) =>
              colibriImports(
                sourceWithoutComments(architectureFileContent(file)),
              ).every((
                { subpath },
              ) => !subpath),
            "Cross-package imports must use the package's public root",
          ),
        `${architecture.name} must not deep-import another package`,
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
            (file) =>
              !PRIVATE_REPOSITORY_IMPORT.test(
                sourceWithoutComments(architectureFileContent(file)),
              ),
            "Published runtime code must not import _internal or _tools modules",
          ),
        `${architecture.name} must be independent from repository-only modules`,
      );
    }
  });

  it("keeps tests and package entrypoints out of runtime dependency paths", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) => {
              const source = sourceWithoutComments(
                architectureFileContent(file),
              );
              return !TEST_MODULE_IMPORT.test(source) &&
                !PUBLIC_ENTRYPOINT_IMPORT.test(source);
            },
            "Runtime modules must not depend on tests or public mod.ts barrels",
          ),
        `${architecture.name} must only depend on runtime internals`,
      );
    }
  });
});
