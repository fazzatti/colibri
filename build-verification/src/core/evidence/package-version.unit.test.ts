import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BUILD_VERIFICATION_PACKAGE_VERSION } from "@/core/evidence/accumulate.ts";

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
