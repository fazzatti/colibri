import { assertEquals } from "@std/assert";
import { resolve } from "node:path";
import type { FileInfo } from "archunit";

export type ArchitectureRule = {
  check(): Promise<unknown[]>;
};

export type PackageArchitecture = {
  name: string;
  root: string;
  config: string;
  source: string;
  allowedColibriDependencies: readonly string[];
};

export const CONFIG_DIRECTORY = "_tools/architecture/config";
export const CORE_CONFIG = `${CONFIG_DIRECTORY}/core.json`;
export const REPOSITORY_CONFIG = `${CONFIG_DIRECTORY}/repository.json`;

export const PACKAGE_ARCHITECTURES: readonly PackageArchitecture[] = [
  {
    name: "@colibri/core",
    root: "core",
    config: CORE_CONFIG,
    source: "../../../core/**/*.ts",
    allowedColibriDependencies: [],
  },
  {
    name: "@colibri/build-verification",
    root: "build-verification",
    config: `${CONFIG_DIRECTORY}/build-verification.json`,
    source: "../../../build-verification/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/identicon",
    root: "identicon",
    config: `${CONFIG_DIRECTORY}/identicon.json`,
    source: "../../../identicon/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/rpc-streamer",
    root: "rpc-streamer",
    config: `${CONFIG_DIRECTORY}/rpc-streamer.json`,
    source: "../../../rpc-streamer/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/webauth",
    root: "webauth",
    config: `${CONFIG_DIRECTORY}/webauth.json`,
    source: "../../../webauth/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/plugin-fee-bump",
    root: "plugins/fee-bump",
    config: `${CONFIG_DIRECTORY}/plugin-fee-bump.json`,
    source: "../../../plugins/fee-bump/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/plugin-channel-accounts",
    root: "plugins/channel-accounts",
    config: `${CONFIG_DIRECTORY}/plugin-channel-accounts.json`,
    source: "../../../plugins/channel-accounts/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/plugin-sep29",
    root: "plugins/sep29",
    config: `${CONFIG_DIRECTORY}/plugin-sep29.json`,
    source: "../../../plugins/sep29/**/*.ts",
    allowedColibriDependencies: ["@colibri/core"],
  },
  {
    name: "@colibri/test-tooling",
    root: "test-tooling",
    config: `${CONFIG_DIRECTORY}/test-tooling.json`,
    source: "../../../test-tooling/**/*.ts",
    allowedColibriDependencies: [],
  },
];

export const assertRule = async (
  rule: ArchitectureRule,
  description: string,
): Promise<void> => {
  const violations = await rule.check();
  assertEquals(violations, [], description);
};

/**
 * Reads an ArchUnitTS file relative to the config directory used to build its
 * graph. ArchUnitTS 2.4 exposes graph-relative paths but resolves custom-rule
 * content from the process directory, which otherwise leaves content empty.
 */
export const architectureFileContent = (file: FileInfo): string =>
  Deno.readTextFileSync(resolve(CONFIG_DIRECTORY, file.path));

/** Removes comments before import and executable-code convention checks. */
export const sourceWithoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

export const readDirectoryNames = async (
  directory: string,
  kind: "file" | "directory",
): Promise<string[]> => {
  const names: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (kind === "file" ? entry.isFile : entry.isDirectory) {
      names.push(entry.name);
    }
  }
  return names.sort();
};
