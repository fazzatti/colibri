import { Contract, extractContractSpec } from "@colibri/core";
import { Spec } from "@colibri/core";
import type { BindingSource, LoadedBindingSource } from "@/types.ts";
import { BindingError, Code } from "@/error.ts";

/** Loads an ABI without submitting transactions; local sources require no RPC. */
export async function loadBindingSource(
  source: BindingSource,
): Promise<LoadedBindingSource> {
  try {
    if (source.kind === "spec") {
      return {
        spec: new Spec(
          source.spec.entries.map((entry) => entry.toXdr("base64")),
        ),
        provenance: { kind: "spec" },
      };
    }
    if (source.kind === "wasm") {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(source.wasm),
      );
      const wasmHash = Array.from(
        new Uint8Array(digest),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      return {
        spec: extractContractSpec(source.wasm),
        provenance: { kind: "wasm", wasmHash },
      };
    }
    const contractConfig = source.kind === "contract"
      ? { contractId: source.contractId }
      : { wasmHash: source.wasmHash };
    const contract = new Contract({
      networkConfig: source.networkConfig,
      contractConfig,
      rpc: source.rpc,
    });
    await contract.loadSpecFromNetwork();
    const snapshot = contract.getLoadedSnapshot();
    return {
      spec: contract.getSpec(),
      provenance: {
        kind: source.kind,
        wasmHash: snapshot?.wasmHash,
        contractId: snapshot?.contractId,
        snapshot,
      },
    };
  } catch (cause) {
    throw new BindingError(
      Code.SOURCE_FAILED,
      `Could not load ${source.kind} contract source`,
      cause,
    );
  }
}
