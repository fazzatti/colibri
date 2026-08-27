import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import * as E from "@/error.ts";
import {
  extractContractMetadata,
  parseOutOfBandRecipe,
  parseSep58Recipe,
} from "@/metadata.ts";
import type { ContractMetadataEntry } from "@/types.ts";

const uleb = (value: number): number[] => {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return bytes;
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

const section = (entries: readonly ContractMetadataEntry[]): Uint8Array => {
  const name = new TextEncoder().encode("contractmetav0");
  const body = concat(
    new Uint8Array([...uleb(name.length), ...name]),
    ...entries.map(({ key, value }) =>
      new Uint8Array(
        xdr.ScMetaEntry.scMetaV0(new xdr.ScMetaV0({ key, val: value })).toXDR(),
      )
    ),
  );
  return new Uint8Array([0, ...uleb(body.length), ...body]);
};

const rawSection = (xdrBytes: Uint8Array): Uint8Array => {
  const name = new TextEncoder().encode("contractmetav0");
  const body = concat(
    new Uint8Array([...uleb(name.length), ...name]),
    xdrBytes,
  );
  return new Uint8Array([0, ...uleb(body.length), ...body]);
};

const wasm = (...sections: Uint8Array[]): Uint8Array =>
  concat(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]), ...sections);

const digest = "a".repeat(64);
const image = `docker.io/stellar/stellar-cli@sha256:${digest}`;

describe("contract metadata", () => {
  it("selects the CLI section and decodes ordered XDR entries", () => {
    const embedded = section([{ key: "name", value: "embedded" }]);
    const cli = section([{ key: "cliver", value: "1" }, {
      key: "bldimg",
      value: image,
    }]);
    assertEquals(extractContractMetadata(wasm(embedded, cli)), [
      { key: "cliver", value: "1" },
      { key: "bldimg", value: image },
    ]);
  });

  it("uses the final non-empty section when no CLI marker exists", () => {
    assertEquals(
      extractContractMetadata(
        wasm(section([]), section([{ key: "x", value: "y" }])),
      ),
      [{ key: "x", value: "y" }],
    );
    assertEquals(extractContractMetadata(wasm()), []);
  });

  it("rejects invalid wasm and malformed metadata XDR", () => {
    assertThrows(
      () => extractContractMetadata(new Uint8Array([1])),
      E.InvalidTargetWasmError,
    );
    assertThrows(
      () => extractContractMetadata(wasm(rawSection(new Uint8Array([1, 2])))),
      E.MetadataDecodingFailedError,
    );
    const encoded = new Uint8Array(
      xdr.ScMetaEntry.scMetaV0(new xdr.ScMetaV0({ key: "a", val: "b" }))
        .toXDR(),
    );
    encoded[9] = 1;
    assertThrows(
      () => extractContractMetadata(wasm(rawSection(encoded))),
      E.MetadataDecodingFailedError,
    );
  });

  it("parses strict SEP-58 defaults and preserves repeatable values", () => {
    const recipe = parseSep58Recipe([
      { key: "cliver", value: "1" },
      { key: "bldimg", value: image },
      { key: "source_uri", value: "https://example.com/source.tar.gz" },
      { key: "source_sha256", value: digest },
      { key: "bldopt", value: "--package=hello" },
      { key: "name", value: "hello" },
    ]);
    assertEquals(recipe, {
      image,
      arguments: ["contract", "build"],
      options: ["--package=hello"],
      metadata: [
        { key: "bldimg", value: image },
        { key: "source_uri", value: "https://example.com/source.tar.gz" },
        { key: "source_sha256", value: digest },
        { key: "bldopt", value: "--package=hello" },
        { key: "name", value: "hello" },
      ],
      sourceUri: "https://example.com/source.tar.gz",
      sourceSha256: digest,
    });
    assertEquals(parseSep58Recipe([{ key: "name", value: "x" }]), null);
  });

  it("uses explicit bldarg order", () => {
    assertEquals(
      parseSep58Recipe([
        { key: "bldimg", value: image },
        { key: "source_sha256", value: digest },
        { key: "bldarg", value: "contract" },
        { key: "bldarg", value: "build" },
      ])?.arguments,
      ["contract", "build"],
    );
  });

  it("rejects duplicate or invalid strict metadata", () => {
    assertThrows(
      () =>
        parseSep58Recipe([{ key: "bldimg", value: image }, {
          key: "bldimg",
          value: image,
        }]),
      E.DuplicateSep58MetadataError,
    );
    assertThrows(
      () => parseSep58Recipe([{ key: "source_sha256", value: digest }]),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () =>
        parseSep58Recipe([{ key: "bldimg", value: "latest" }, {
          key: "source_sha256",
          value: digest,
        }]),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () =>
        parseSep58Recipe([{ key: "bldimg", value: image }, {
          key: "source_sha256",
          value: "A".repeat(64),
        }]),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () =>
        parseSep58Recipe([{ key: "bldimg", value: image }, {
          key: "source_sha256",
          value: digest,
        }, { key: "bldarg", value: "" }]),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () =>
        parseSep58Recipe([{ key: "bldimg", value: image }, {
          key: "source_sha256",
          value: digest,
        }, { key: "bldopt", value: "-x" }]),
      E.InvalidSep58MetadataError,
    );
  });

  it("normalizes and validates out-of-band recipes", () => {
    assertEquals(parseOutOfBandRecipe({ image }), {
      image,
      arguments: ["contract", "build"],
      options: [],
      metadata: [],
      sourceSha256: undefined,
    });
    assertEquals(
      parseOutOfBandRecipe({
        image,
        arguments: ["x"],
        options: ["--x=y"],
        metadata: [{ key: "a", value: "b" }],
        sourceSha256: digest,
      }).arguments,
      ["x"],
    );
    assertThrows(
      () => parseOutOfBandRecipe({ image: "latest" }),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () => parseOutOfBandRecipe({ image, arguments: [] }),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () => parseOutOfBandRecipe({ image, arguments: [""] }),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () => parseOutOfBandRecipe({ image, options: ["x"] }),
      E.InvalidSep58MetadataError,
    );
    assertThrows(
      () => parseOutOfBandRecipe({ image, sourceSha256: "bad" }),
      E.InvalidSep58MetadataError,
    );
  });
});
