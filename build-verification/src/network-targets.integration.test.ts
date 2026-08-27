import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assertEquals } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { NetworkConfig } from "@colibri/core";
import { sha256Hex } from "@/hash.ts";
import { ContractBuildVerifier } from "@/verifier.ts";
import type { ContractBuildRunner } from "@/types.ts";

const rebuiltFixture = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

describe(
  "public-network build-verification targets",
  disableSanitizeConfig,
  () => {
    let sourceDirectory: string;
    let image: string;
    let fetcher: typeof fetch;

    beforeAll(async () => {
      sourceDirectory = await Deno.makeTempDir();
      const manifest = new TextEncoder().encode(JSON.stringify({
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }));
      image = `docker.io/stellar/stellar-cli@sha256:${await sha256Hex(
        manifest,
      )}`;
      fetcher = () => Promise.resolve(new Response(Uint8Array.from(manifest)));
    });

    afterAll(async () => {
      await Deno.remove(sourceDirectory, { recursive: true });
    });

    const runner: ContractBuildRunner = {
      run: () =>
        Promise.resolve({
          wasm: rebuiltFixture,
          artifactPath: "/source/target/wasm32v1-none/release/fixture.wasm",
          stdout: "",
          stderr: "",
          durationMs: 1,
        }),
    };

    it("resolves an installed Testnet wasm hash", async () => {
      const result = await new ContractBuildVerifier({
        network: NetworkConfig.TestNet(),
        runner,
        fetch: fetcher,
      }).verify({
        mode: "outOfBand",
        target: {
          wasmHash:
            "6418425c03befb451ccc3e5dd64233a66a028174c757404c719bb24d91e73b26",
        },
        source: { type: "path", path: sourceDirectory },
        recipe: { image },
      });
      assertEquals(result.status, "mismatch");
      if (result.status === "mismatch") {
        assertEquals(result.evidence.target.kind, "wasmHash");
        assertEquals(
          result.evidence.target.lastModifiedLedgerSeq !== undefined,
          true,
        );
      }
    });

    it("resolves a selected deployed Mainnet contract", async () => {
      const contractId =
        "CCQLLRE5JBAWYCW3KTWOIWLMFDUOKROQVZNSALQMGOSXNW3ERUOWTZGK";
      const result = await new ContractBuildVerifier({
        network: NetworkConfig.MainNet(),
        runner,
        fetch: fetcher,
      }).verify({
        mode: "outOfBand",
        target: { contractId },
        source: { type: "path", path: sourceDirectory },
        recipe: { image },
      });
      assertEquals(result.status, "mismatch");
      if (result.status === "mismatch") {
        assertEquals(result.evidence.target.contractId, contractId);
        assertEquals(result.evidence.target.kind, "contractId");
      }
    });
  },
);
