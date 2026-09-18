import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { BUILD_VERIFICATION_PACKAGE_VERSION } from "@/core/evidence/accumulate.ts";

const { describe, it } = recordColibriTests(import.meta.url);

type PackageMetadata = {
  name?: unknown;
  version?: unknown;
};

describe("build verification package version", () => {
  it("matches the package metadata declared in deno.json", async () => {
    const metadata = JSON.parse(
      await Deno.readTextFile(
        new URL("../../../deno.json", import.meta.url),
      ),
    ) as PackageMetadata;

    assertEquals(metadata.name, "@colibri/build-verification");
    assertEquals(metadata.version, BUILD_VERIFICATION_PACKAGE_VERSION);
  });
});
