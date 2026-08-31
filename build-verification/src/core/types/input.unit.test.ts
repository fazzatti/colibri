import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";

describe("contract build-verification input redaction", () => {
  it("redacts direct Wasm bytes and preserves each network target shape", () => {
    assertEquals(
      redactContractBuildVerificationInput({
        target: { wasm: new Uint8Array([1, 2, 3]), label: "local" },
      }),
      {
        mode: "strictSep58",
        target: { kind: "wasm", label: "local", wasmLength: 3 },
        source: undefined,
      },
    );
    assertEquals(
      redactContractBuildVerificationInput({
        target: { wasmHash: "a".repeat(64), label: "code" },
      }),
      {
        mode: "strictSep58",
        target: { kind: "wasmHash", wasmHash: "a".repeat(64), label: "code" },
        source: undefined,
      },
    );
    assertEquals(
      redactContractBuildVerificationInput({
        target: { contractId: "C123", label: "contract" },
      }),
      {
        mode: "strictSep58",
        target: { kind: "contractId", contractId: "C123", label: "contract" },
        source: undefined,
      },
    );
  });

  it("removes archive bytes and URL credentials without changing other sources", () => {
    assertEquals(
      redactContractBuildVerificationInput({
        target: { wasm: new Uint8Array() },
        source: {
          type: "archive",
          bytes: new Uint8Array([1, 2]),
          name: "source.tar",
          format: "tar",
        },
      }).source,
      { type: "archive", name: "source.tar", size: 2, format: "tar" },
    );
    assertEquals(
      redactContractBuildVerificationInput({
        target: { wasm: new Uint8Array() },
        source: {
          type: "url",
          url:
            "https://alice:secret@example.com/source.zip?token=secret&X-Amz-Signature=signed&page=1",
        },
      }).source,
      {
        type: "url",
        url:
          "https://example.com/source.zip?token=%3Credacted%3E&X-Amz-Signature=%3Credacted%3E&page=1",
      },
    );
    assertEquals(
      redactContractBuildVerificationInput({
        target: { wasm: new Uint8Array() },
        source: { type: "url", url: "not a URL" },
      }).source,
      { type: "url", url: "not a URL" },
    );
    assertEquals(
      redactContractBuildVerificationInput({
        target: { wasm: new Uint8Array() },
        source: { type: "path", path: "./source" },
      }).source,
      { type: "path", path: "./source" },
    );
  });

  it("retains an explicit out-of-band recipe as structured data", () => {
    const recipe = {
      image: "docker.io/stellar/stellar-cli@sha256:abc",
      arguments: ["contract", "build"],
    } as const;
    assertEquals(
      redactContractBuildVerificationInput({
        mode: "outOfBand",
        target: { wasm: new Uint8Array() },
        source: { type: "path", path: "./source" },
        recipe,
      }).recipe,
      recipe,
    );
  });
});
