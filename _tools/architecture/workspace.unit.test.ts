import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  PACKAGE_ARCHITECTURES,
  readDirectoryNames,
} from "colibri-tools/architecture/shared.ts";

type PackageManifest = {
  name?: string;
  exports?: string | Record<string, string>;
  imports?: Record<string, string>;
  publish?: {
    exclude?: string[];
    include?: string[];
  };
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
};

const readManifest = async (root: string): Promise<PackageManifest> =>
  JSON.parse(await Deno.readTextFile(`${root}/deno.json`)) as PackageManifest;

const exportPaths = (manifest: PackageManifest): string[] =>
  typeof manifest.exports === "string"
    ? [manifest.exports]
    : Object.values(manifest.exports ?? {});

const publishPath = (path: string): string => path.replace(/^\.\//, "");

const sourceDirectories = async (root: string): Promise<string[]> => {
  const directories = await readDirectoryNames(root, "directory");
  const populated: string[] = [];
  for (const directory of directories) {
    if (await exists(`${root}/${directory}/index.ts`)) {
      populated.push(directory);
    }
  }
  return populated;
};

const constantName = (name: string): string =>
  `${name.replaceAll("-", "_").toUpperCase()}_STEP_ID`;

const functionName = (name: string): string =>
  name.replace(
    /-([a-z0-9])/g,
    (_, character: string) => character.toUpperCase(),
  );

const assertStepTopology = async (
  processRoot: string,
  stepRoot: string,
): Promise<void> => {
  const processes = await sourceDirectories(processRoot);
  const steps = (await readDirectoryNames(stepRoot, "file"))
    .filter((name) => name.endsWith(".ts"))
    .filter((name) => name !== "ids.ts" && name !== "index.ts")
    .map((name) => name.replace(/\.ts$/, ""));

  assertEquals(steps, processes);
  const identifiers = await Deno.readTextFile(`${stepRoot}/ids.ts`);
  for (const process of processes) {
    const id = constantName(process);
    const callable = functionName(process);
    const step = await Deno.readTextFile(`${stepRoot}/${process}.ts`);
    assert(
      new RegExp(
        `export\\s+const\\s+${id}\\s*=\\s*["']${process}["']`,
      ).test(identifiers),
      `${stepRoot}/ids.ts must map ${id} to ${process}`,
    );
    assert(
      new RegExp(`\\bstep\\(\\s*${callable}\\s*,`).test(step),
      `${stepRoot}/${process}.ts must wrap ${callable}`,
    );
    assert(
      new RegExp(`\\bid\\s*:\\s*${id}\\b`).test(step),
      `${stepRoot}/${process}.ts must use ${id}`,
    );
  }
};

describe("workspace structure", () => {
  it("keeps every published package complete and explicitly registered", async () => {
    const root = JSON.parse(await Deno.readTextFile("deno.json")) as {
      workspace?: string[];
    };
    assertEquals(root.workspace, [
      "./core",
      "./build-verification",
      "./identicon",
      "./rpc-streamer",
      "./webauth",
      "./plugins/*",
      "./test-tooling",
    ]);

    for (const architecture of PACKAGE_ARCHITECTURES) {
      const manifest = await readManifest(architecture.root);
      assertEquals(manifest.name, architecture.name);
      assert(await exists(`${architecture.root}/README.md`));
      assert(await exists(`${architecture.root}/LICENSE`));
      const published = (manifest.publish?.include ?? []).map(publishPath);
      for (const required of ["README.md", "LICENSE", "deno.json"]) {
        assert(
          published.includes(required),
          `${architecture.name} must publish ${required}`,
        );
      }
      assertEquals(
        manifest.imports?.["@/"],
        architecture.root === "core" ||
          architecture.root === "test-tooling"
          ? "./"
          : "./src/",
      );
      assert(
        manifest.publish?.exclude?.includes("./**/*.test.ts"),
        `${architecture.name} must exclude test modules from publication`,
      );
      assert(
        !(manifest.publish?.include ?? []).some((path) =>
          path.includes("_internal") || path.includes("_tools")
        ),
        `${architecture.name} must not publish repository-only directories`,
      );
      for (const entrypoint of exportPaths(manifest)) {
        const normalized = entrypoint.replace(/^\.\//, "");
        assert(
          normalized.endsWith(".ts") &&
            !normalized.endsWith(".test.ts") &&
            !normalized.startsWith("../") &&
            await exists(`${architecture.root}/${normalized}`),
          `${architecture.name} export ${entrypoint} must stay inside the package`,
        );
      }
    }
  });

  it("keeps Core processes and steps in a one-to-one topology", async () => {
    const processes = await sourceDirectories("core/processes");
    await assertStepTopology("core/processes", "core/steps");
    for (const process of processes) {
      for (const module of ["index.ts", "types.ts", "error.ts"]) {
        assert(
          await exists(`core/processes/${process}/${module}`),
          `core/processes/${process} is missing ${module}`,
        );
      }
    }
  });

  it("keeps build-verification processes and steps in a one-to-one topology", async () => {
    const processes = await sourceDirectories(
      "build-verification/src/processes",
    );
    await assertStepTopology(
      "build-verification/src/processes",
      "build-verification/src/steps",
    );
    for (const process of processes) {
      for (const module of ["index.ts", "types.ts", "error.ts"]) {
        assert(
          await exists(
            `build-verification/src/processes/${process}/${module}`,
          ),
          `build-verification process ${process} is missing ${module}`,
        );
      }
    }
  });

  it("keeps pipeline modules structurally complete", async () => {
    const pipelineRoots = [
      "core/pipelines/classic-transaction",
      "core/pipelines/invoke-contract",
      "core/pipelines/read-from-contract",
      "build-verification/src/pipelines/build-verification",
    ];

    for (const pipeline of pipelineRoots) {
      for (
        const module of ["connectors.ts", "error.ts", "index.ts", "types.ts"]
      ) {
        assert(
          await exists(`${pipeline}/${module}`),
          `${pipeline} is missing ${module}`,
        );
      }
    }
  });

  it("preserves stable public pipeline identifiers", async () => {
    const identifiers: Readonly<
      Record<string, { constant: string; value: string }>
    > = {
      "core/pipelines/classic-transaction/index.ts": {
        constant: "CLASSIC_TRANSACTION_PIPELINE_ID",
        value: "ClassicTransactionPipeline",
      },
      "core/pipelines/invoke-contract/index.ts": {
        constant: "INVOKE_CONTRACT_PIPELINE_ID",
        value: "InvokeContractPipeline",
      },
      "core/pipelines/read-from-contract/index.ts": {
        constant: "READ_FROM_CONTRACT_PIPELINE_ID",
        value: "ReadFromContractPipeline",
      },
      "build-verification/src/pipelines/build-verification/index.ts": {
        constant: "BUILD_VERIFICATION_PIPELINE_ID",
        value: "BuildVerificationPipeline",
      },
    };

    for (const [path, { constant, value }] of Object.entries(identifiers)) {
      assert(
        new RegExp(
          `export\\s+const\\s+${constant}\\s*=\\s*["']${value}["']`,
        ).test(await Deno.readTextFile(path)),
        `${path} must preserve its public pipeline id`,
      );
    }
  });
});
