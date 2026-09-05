import { describe, it } from "@std/testing/bdd";
import { projectFiles } from "archunit";
import { basename } from "node:path";
import {
  architectureFileContent,
  assertRule,
  PACKAGE_ARCHITECTURES,
  REPOSITORY_CONFIG,
  sourceWithoutComments,
} from "colibri-tools/architecture/shared.ts";

const KEBAB_CASE_FILE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.(?:error|unit\.test|integration\.test|testnet\.integration\.test|test))?\.ts$/;
const KEBAB_CASE_DIRECTORY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEST_SUITE_FILE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:unit|integration|testnet\.integration)\.test\.ts$/;

const genericErrorCount = (content: string): number =>
  [...content.matchAll(/\bthrow\s+new\s+Error\s*\(/g)].length;

describe("module conventions", () => {
  it("uses public Stellar RPC methods in published code", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config).inPath(architecture.source).should()
          .adhereTo(
            (file) =>
              !/\.\s*_(?:get|send|simulate)[A-Z]\w*\s*\(/.test(
                sourceWithoutComments(architectureFileContent(file)),
              ),
            "Use public RPC methods and adapt their native response types at the boundary",
          ),
        `${architecture.name} must not call private RPC methods`,
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
            (file) =>
              !/\bexport\s+default\b/.test(
                sourceWithoutComments(architectureFileContent(file)),
              ),
            "Published modules must use named exports",
          ),
        `${architecture.name} must not declare default exports`,
      );
    }
  });

  it("uses kebab-case TypeScript file and directory names", async () => {
    await assertRule(
      projectFiles(REPOSITORY_CONFIG)
        .inPath(
          /^\.\.\/\.\.\/\.\.\/(?:core|build-verification|identicon|rpc-streamer|webauth|plugins|test-tooling)\//,
        )
        .should()
        .adhereTo(
          (file) => {
            const directories = file.directory.split("/").filter((part) =>
              part !== ".." && part !== "."
            );
            return KEBAB_CASE_FILE.test(basename(file.path)) &&
              directories.every((directory) =>
                KEBAB_CASE_DIRECTORY.test(directory)
              );
          },
          "TypeScript modules and directories must use kebab-case names",
        ),
      "Published package trees must use consistent physical naming",
    );
  });

  it("registers executable tests through the BDD API", async () => {
    await assertRule(
      projectFiles(REPOSITORY_CONFIG)
        .withName("*.test.ts")
        .should()
        .adhereTo(
          (file) => {
            const content = sourceWithoutComments(
              architectureFileContent(file),
            );
            if (/\bDeno\.test\s*\(/.test(content)) return false;
            const usesBdd = /["']@std\/testing\/bdd["']/.test(content);
            return !usesBdd || TEST_SUITE_FILE.test(basename(file.path));
          },
          "Executable tests must use describe/it and an explicit test-kind suffix",
        ),
      "Tests must follow the workspace BDD registration convention",
    );
  });

  it("prevents new generic or untyped thrown errors", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      await assertRule(
        projectFiles(architecture.config)
          .inPath(architecture.source)
          .should()
          .adhereTo(
            (file) => {
              const content = sourceWithoutComments(
                architectureFileContent(file),
              );
              if (/\bthrow\s+["'`]/.test(content)) return false;
              const count = genericErrorCount(content);
              return count === 0;
            },
            "Runtime failures must use typed domain errors",
          ),
        `${architecture.name} must not introduce untyped failures`,
      );
    }
  });

  it("keeps module documentation on every published entrypoint", async () => {
    for (const architecture of PACKAGE_ARCHITECTURES) {
      const manifest = JSON.parse(
        await Deno.readTextFile(`${architecture.root}/deno.json`),
      ) as { exports?: string | Record<string, string> };
      const exports = typeof manifest.exports === "string"
        ? [manifest.exports]
        : Object.values(manifest.exports ?? {});

      for (const entrypoint of exports) {
        const path = "../../../" + architecture.root + "/" +
          entrypoint.replace(/^\.\//, "");
        await assertRule(
          projectFiles(architecture.config)
            .inPath(path)
            .should()
            .adhereTo(
              (file) =>
                /(?:^|\n)\s*\*\s+@module(?:\s|\n|\*)/.test(
                  architectureFileContent(file),
                ),
              "Published entrypoints must declare module documentation",
            ),
          `${path} must remain documented`,
        );
      }
    }
  });
});
