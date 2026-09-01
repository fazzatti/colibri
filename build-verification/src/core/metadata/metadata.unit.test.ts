import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import {
  InvalidTargetWasmError,
  MetadataDecodingFailedError,
} from "@/error/core.ts";
import {
  concatBytes,
  contractMetadataSection,
  testWasm,
  unsignedLeb128,
} from "@/testing.test.ts";
import {
  extractContractMetadata,
  extractContractMetadataSections,
} from "@/core/metadata/extract.ts";
import {
  hasSep58Metadata,
  metadataEntriesForEvidence,
} from "@/core/metadata/parse.ts";

const rawSection = (bytes: Uint8Array): Uint8Array => {
  const name = new TextEncoder().encode("contractmetav0");
  const body = concatBytes(
    new Uint8Array([...unsignedLeb128(name.length), ...name]),
    bytes,
  );
  return new Uint8Array([0, ...unsignedLeb128(body.length), ...body]);
};

describe("core contract metadata", () => {
  it("enumerates sections and selects the first CLI-marked section", () => {
    const first = contractMetadataSection([{ key: "name", value: "first" }]);
    const cli = contractMetadataSection([
      { key: "cliver", value: "28" },
      { key: "bldimg", value: "image" },
    ]);
    const later = contractMetadataSection([{ key: "name", value: "later" }]);
    const result = extractContractMetadataSections(testWasm(first, cli, later));
    assertEquals(result.sections.length, 3);
    assertEquals(result.selectedSection, 1);
    assertEquals(result.entries, [
      { key: "cliver", value: "28" },
      { key: "bldimg", value: "image" },
    ]);
    assertEquals(extractContractMetadata(testWasm(first, cli)), result.entries);
  });

  it("selects the final non-empty section and handles empty metadata", () => {
    const empty = contractMetadataSection([]);
    const final = contractMetadataSection([{ key: "name", value: "final" }]);
    assertEquals(extractContractMetadata(testWasm(empty, final)), [
      { key: "name", value: "final" },
    ]);
    assertEquals(extractContractMetadataSections(testWasm()), {
      sections: [],
      selectedSection: undefined,
      entries: [],
    });
  });

  it("rejects invalid Wasm, truncated XDR, and non-zero XDR padding", () => {
    assertThrows(
      () => extractContractMetadata(new Uint8Array([1])),
      InvalidTargetWasmError,
    );
    assertThrows(
      () =>
        extractContractMetadata(testWasm(rawSection(new Uint8Array([1, 2])))),
      MetadataDecodingFailedError,
    );
    const encoded = new Uint8Array(
      xdr.ScMetaEntry.scMetaV0(new xdr.ScMetaV0({ key: "a", val: "b" }))
        .toXdr(),
    );
    encoded[9] = 1;
    assertThrows(
      () => extractContractMetadata(testWasm(rawSection(encoded))),
      MetadataDecodingFailedError,
    );
  });

  it("detects SEP-58 fields and redacts source URI evidence", () => {
    assertEquals(hasSep58Metadata([{ key: "name", value: "x" }]), false);
    for (
      const key of [
        "bldimg",
        "bldarg",
        "bldopt",
        "source_uri",
        "source_sha256",
      ]
    ) {
      assertEquals(hasSep58Metadata([{ key, value: "x" }]), true);
    }
    assertEquals(
      metadataEntriesForEvidence([
        { key: "name", value: "unchanged" },
        {
          key: "source_uri",
          value:
            "https://user:password@example.com/source.tar.gz?token=value&plain=yes",
        },
        { key: "source_uri", value: "not a URL" },
      ]),
      [
        { key: "name", value: "unchanged" },
        {
          key: "source_uri",
          value:
            "https://example.com/source.tar.gz?token=%3Credacted%3E&plain=yes",
        },
        { key: "source_uri", value: "<invalid-uri>" },
      ],
    );
  });
});
