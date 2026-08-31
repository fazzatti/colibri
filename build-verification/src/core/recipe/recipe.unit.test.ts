import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  DuplicateSep58MetadataError,
  InvalidSep58MetadataError,
} from "@/error/core.ts";
import { TEST_IMAGE } from "@/testing.test.ts";
import { createContractBuildArguments } from "@/core/recipe/build-command.ts";
import { parseOutOfBandRecipe } from "@/core/recipe/parse-out-of-band.ts";
import { parseSep58Recipe } from "@/core/recipe/parse-sep58.ts";
import { isContractBuildVerificationInput } from "@/core/recipe/validate.ts";

const hash = "c".repeat(64);

describe("core build recipes", () => {
  it("parses strict defaults, ordered repeats, and regenerated metadata", () => {
    const recipe = parseSep58Recipe([
      { key: "cliver", value: "28" },
      { key: "rsver", value: "1" },
      { key: "rssdkver", value: "2" },
      { key: "bldimg", value: TEST_IMAGE },
      { key: "source_uri", value: "https://example.com/source.tar.gz" },
      { key: "source_sha256", value: hash },
      { key: "bldopt", value: "--locked" },
      { key: "name", value: "contract" },
    ]);
    assertEquals(recipe, {
      image: TEST_IMAGE,
      arguments: ["contract", "build"],
      options: ["--locked"],
      metadata: [
        { key: "bldimg", value: TEST_IMAGE },
        { key: "source_uri", value: "https://example.com/source.tar.gz" },
        { key: "source_sha256", value: hash },
        { key: "bldopt", value: "--locked" },
        { key: "name", value: "contract" },
      ],
      sourceUri: "https://example.com/source.tar.gz",
      sourceSha256: hash,
    });
    assertEquals(parseSep58Recipe([{ key: "name", value: "x" }]), null);
    assertEquals(
      parseSep58Recipe([
        { key: "bldimg", value: TEST_IMAGE },
        { key: "source_sha256", value: hash },
        { key: "bldarg", value: "contract" },
        { key: "bldarg", value: "build" },
      ])?.arguments,
      ["contract", "build"],
    );
  });

  it("rejects every invalid strict scalar and argument occurrence", () => {
    for (const key of ["bldimg", "source_uri", "source_sha256"]) {
      assertThrows(
        () => parseSep58Recipe([{ key, value: "x" }, { key, value: "y" }]),
        DuplicateSep58MetadataError,
      );
    }
    const invalid = [
      [{ key: "source_sha256", value: hash }],
      [
        { key: "bldimg", value: "latest" },
        { key: "source_sha256", value: hash },
      ],
      [
        { key: "bldimg", value: TEST_IMAGE },
        { key: "source_sha256", value: "BAD" },
      ],
      [
        { key: "bldimg", value: TEST_IMAGE },
        { key: "source_sha256", value: hash },
        { key: "bldarg", value: "" },
      ],
      [
        { key: "bldimg", value: TEST_IMAGE },
        { key: "source_sha256", value: hash },
        { key: "bldopt", value: "-x" },
      ],
    ];
    for (const entries of invalid) {
      assertThrows(() => parseSep58Recipe(entries), InvalidSep58MetadataError);
    }
  });

  it("normalizes out-of-band recipes and rejects malformed fields", () => {
    assertEquals(parseOutOfBandRecipe({ image: TEST_IMAGE }), {
      image: TEST_IMAGE,
      arguments: ["contract", "build"],
      options: [],
      metadata: [],
      sourceSha256: undefined,
    });
    assertEquals(
      parseOutOfBandRecipe({
        image: TEST_IMAGE,
        arguments: ["contract", "build"],
        options: ["--locked"],
        metadata: [{ key: "name", value: "hello" }],
        sourceSha256: hash,
      }).sourceSha256,
      hash,
    );
    const invalid = [
      { image: "latest" },
      { image: TEST_IMAGE, arguments: [] },
      { image: TEST_IMAGE, arguments: [""] },
      { image: TEST_IMAGE, options: ["locked"] },
      { image: TEST_IMAGE, sourceSha256: "BAD" },
    ];
    for (const recipe of invalid) {
      assertThrows(
        () => parseOutOfBandRecipe(recipe),
        InvalidSep58MetadataError,
      );
    }
  });

  it("assembles exact structured arguments and metadata replay", () => {
    assertEquals(
      createContractBuildArguments({
        image: TEST_IMAGE,
        arguments: ["contract", "build"],
        options: ["--locked", "--package=hello"],
        metadata: [{ key: "name", value: "hello" }],
      }),
      [
        "contract",
        "build",
        "--locked",
        "--package=hello",
        "--meta",
        "name=hello",
      ],
    );
  });

  it("mirrors the public strict and out-of-band input union at runtime", () => {
    const target = { wasm: new Uint8Array() };
    assertEquals(isContractBuildVerificationInput(null), false);
    assertEquals(isContractBuildVerificationInput({}), false);
    assertEquals(
      isContractBuildVerificationInput({ target, mode: "other" }),
      false,
    );
    assertEquals(isContractBuildVerificationInput({ target }), true);
    assertEquals(
      isContractBuildVerificationInput({
        target,
        mode: "strictSep58",
        recipe: {},
      }),
      false,
    );
    assertEquals(
      isContractBuildVerificationInput({
        target,
        mode: "outOfBand",
        recipe: {},
      }),
      false,
    );
    assertEquals(
      isContractBuildVerificationInput({
        target,
        mode: "outOfBand",
        source: { type: "path", path: "." },
        recipe: null,
      }),
      false,
    );
    assertEquals(
      isContractBuildVerificationInput({
        target,
        mode: "outOfBand",
        source: { type: "path", path: "." },
        recipe: {},
      }),
      true,
    );
  });
});
