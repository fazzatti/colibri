import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { parseSep58Recipe } from "@/core/recipe/parse-sep58.ts";
import { TEST_IMAGE } from "@/testing.test.ts";
import * as ERROR from "@/error/core.ts";
const { describe, it } = recordColibriTests(import.meta.url);
const base = [{ key: "bldimg", value: TEST_IMAGE }, {
  key: "source_sha256",
  value: "a".repeat(64),
}];
describe("SEP-58 field grammar", () => {
  it("rejects malformed flags, URI and non-ASCII arguments before policy execution", () => {
    for (
      const [key, value] of [
        ["bldopt", "--flag\n"],
        ["bldarg", "build\n"],
        ["source_uri", "https://example.com/a\n"],
        ["bldopt", "--"],
        ["bldopt", "--bad flag"],
        ["bldopt", "--1bad"],
        ["bldopt", "--flag="],
        ["source_uri", "not-a-uri"],
        ["source_uri", "https://a b"],
        ["bldarg", "é"],
        ["bldarg", "a\nb"],
      ]
    ) {
      assertThrows(
        () => parseSep58Recipe([...base, { key, value }]),
        ERROR.InvalidSep58MetadataError,
      );
    }
  });
  it("validates the entire scalar and regenerated metadata values", () => {
    for (const entry of base) {
      const bad = base.map((item) =>
        item.key === entry.key ? { ...item, value: item.value + "\n" } : item
      );
      assertThrows(
        () => parseSep58Recipe(bad),
        ERROR.InvalidSep58MetadataError,
      );
    }
    for (const key of ["cliver", "rsver", "rssdkver"]) {
      assertThrows(
        () => parseSep58Recipe([...base, { key, value: "é" }]),
        ERROR.InvalidSep58MetadataError,
      );
    }
  });
  it("preserves ordered arguments, repeated flags and scheme-neutral optional sources", () => {
    const recipe = parseSep58Recipe([
      ...base,
      { key: "bldarg", value: "contract" },
      { key: "bldarg", value: "build" },
      { key: "bldopt", value: "--features=a,b" },
      { key: "bldopt", value: "--features=c" },
      { key: "source_uri", value: "ipfs:bafy/archive.tar" },
    ])!;
    assertEquals(recipe.arguments, ["contract", "build"]);
    assertEquals(recipe.options, ["--features=a,b", "--features=c"]);
    assertEquals(recipe.sourceUri, "ipfs:bafy/archive.tar");
    assertEquals(parseSep58Recipe(base)?.sourceUri, undefined);
  });
});
