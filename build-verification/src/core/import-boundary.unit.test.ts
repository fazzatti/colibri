import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

type DenoInfoModule = {
  readonly specifier: string;
};

type DenoInfoOutput = {
  readonly modules: readonly DenoInfoModule[];
};

const packageRoot = new URL("../../", import.meta.url);
const coreEntrypoint = decodeURIComponent(
  new URL("../../core.ts", import.meta.url).pathname,
);

describe("core entrypoint import boundary", () => {
  it("contains only deterministic core and error modules from this package", async () => {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["info", "--json", coreEntrypoint],
      cwd: packageRoot,
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    assertEquals(
      output.success,
      true,
      new TextDecoder().decode(output.stderr),
    );

    const graph = JSON.parse(
      new TextDecoder().decode(output.stdout),
    ) as DenoInfoOutput;
    const packageModules = graph.modules
      .map(({ specifier }) => specifier)
      .filter((specifier) =>
        specifier.startsWith(new URL("../../", import.meta.url).href)
      );

    const unexpectedPackageModules = packageModules.filter((specifier) =>
      !specifier.endsWith("/build-verification/core.ts") &&
      !specifier.includes("/build-verification/src/core/") &&
      !specifier.includes("/build-verification/src/error/")
    );
    assertEquals(unexpectedPackageModules, []);

    const forbiddenExternalModules = graph.modules
      .map(({ specifier }) => specifier)
      .filter((specifier) =>
        specifier === "dockerode" ||
        specifier.includes("dockerode") ||
        specifier.startsWith("node:fs") ||
        specifier.startsWith("node:os") ||
        specifier.includes("/build-verification/src/archive/") ||
        specifier.includes("/build-verification/src/providers/") ||
        specifier.includes("/build-verification/src/reporting/") ||
        specifier.includes("/build-verification/src/runners/") ||
        specifier.includes("/build-verification/src/verifier/") ||
        specifier.includes("/build-verification/src/cli/")
      );
    assertEquals(forbiddenExternalModules, []);
  });
});
