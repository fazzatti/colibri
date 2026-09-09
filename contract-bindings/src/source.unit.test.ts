import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";
import {
  buildContractCodeLedgerKey,
  buildContractInstanceLedgerKey,
  NetworkConfig,
} from "@colibri/core";
import { loadBindingSource } from "@/source.ts";
import { BindingError } from "@/error.ts";
import {
  bindingSpec,
  contractId,
} from "colibri-internal/tests/binding-fixtures.ts";

describe("binding sources", () => {
  it("clones specs and hashes local Wasm without a network", async () => {
    const spec = bindingSpec();
    const copy = await loadBindingSource({ kind: "spec", spec });
    assert(copy.spec !== spec);
    const wasm = await Deno.readFile(
      "_internal/tests/compiled-contracts/types_harness.wasm",
    );
    const loaded = await loadBindingSource({ kind: "wasm", wasm });
    assertEquals(loaded.provenance.wasmHash?.length, 64);
    await assertRejects(
      () => loadBindingSource({ kind: "wasm", wasm: new Uint8Array(4) }),
      BindingError,
    );
  });
  it("resolves hashes and contract IDs through Core with exact code provenance", async () => {
    const wasm = await Deno.readFile(
      "_internal/tests/compiled-contracts/types_harness.wasm",
    );
    const local = await loadBindingSource({ kind: "wasm", wasm });
    const hash = local.provenance.wasmHash!;
    const entries: Api.LedgerEntryResult[] = [
      {
        key: buildContractCodeLedgerKey({ hash }),
        val: xdr.LedgerEntryData.contractCode(
          new xdr.ContractCodeEntry({
            ext: xdr.ContractCodeEntryExt.v0(),
            hash: xdr.decodeBytes(hash, "hex"),
            code: wasm,
          }),
        ),
      },
      {
        key: buildContractInstanceLedgerKey({ contractId }),
        val: xdr.LedgerEntryData.contractData(
          new xdr.ContractDataEntry({
            ext: xdr.ExtensionPoint.v0(),
            contract: Address.fromString(contractId).toScAddress(),
            key: xdr.ScVal.scvLedgerKeyContractInstance(),
            durability: xdr.ContractDataDurability.persistent,
            val: xdr.ScVal.scvContractInstance(
              new xdr.ScContractInstance({
                executable: xdr.ContractExecutable.contractExecutableWasm(
                  xdr.decodeBytes(hash, "hex"),
                ),
                storage: [],
              }),
            ),
          }),
        ),
      },
    ];
    const rpc = {
      getLedgerEntries: (...keys: xdr.LedgerKey[]) =>
        Promise.resolve({
          latestLedger: 1234,
          entries: entries.filter((entry) =>
            keys.some((key) =>
              key.toXdr("base64") === entry.key.toXdr("base64")
            )
          ),
        }),
    } as unknown as Server;
    const networkConfig = NetworkConfig.TestNet();
    const byHash = await loadBindingSource({
      kind: "hash",
      wasmHash: hash,
      networkConfig,
      rpc,
    });
    const byId = await loadBindingSource({
      kind: "contract",
      contractId,
      networkConfig,
      rpc,
    });
    assertEquals(byHash.provenance.wasmHash, hash);
    assertEquals(byId.provenance.wasmHash, hash);
    assertEquals(byId.provenance.contractId, contractId);
    assertEquals(byId.provenance.snapshot?.observedAtLedger, 1234);
    assertEquals(
      byHash.spec.entries.map((entry) => entry.toXdr()),
      byId.spec.entries.map((entry) => entry.toXdr()),
    );
    await assertRejects(
      () =>
        loadBindingSource({
          kind: "hash",
          wasmHash: "invalid",
          networkConfig,
          rpc,
        }),
      BindingError,
    );
  });
});
