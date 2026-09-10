import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { Contract } from "@/contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { buildContractDataLedgerKey } from "@/ledger-entries/index.ts";
import { LEDGER_ENTRY_NOT_FOUND } from "@/ledger-entries/error.ts";
import * as E from "@/contract/error.ts";

const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const key = xdr.ScVal.scvSymbol("counter");

describe("Contract.getLedgerEntry", () => {
  it("binds the contract ID and RPC, preserving durability, value and metadata without a spec", async () => {
    for (const durability of [undefined, "persistent", "temporary"] as const) {
      const expected = buildContractDataLedgerKey({
        contractId,
        key,
        durability,
      });
      const value = xdr.ScVal.scvU32(42);
      const val = xdr.LedgerEntryData.contractData(
        new xdr.ContractDataEntry({
          ext: xdr.ExtensionPoint.v0(),
          contract: Address.fromString(contractId).toScAddress(),
          key,
          durability: xdr.ContractDataDurability[durability ?? "persistent"],
          val: value,
        }),
      );
      let calls = 0;
      const rpc = {
        getLedgerEntries: (...keys: xdr.LedgerKey[]) => {
          calls++;
          assertEquals(keys.map((key) => key.toXdr("base64")), [
            expected.toXdr("base64"),
          ]);
          return Promise.resolve({
            latestLedger: 10,
            entries: [{
              key: expected,
              val,
              lastModifiedLedgerSeq: 9,
              liveUntilLedgerSeq: 100,
            }],
          });
        },
      } as unknown as Server;
      const contract = new Contract({
        networkConfig: NetworkConfig.TestNet(),
        contractConfig: { contractId },
        rpc,
      });
      // Extra properties from a JavaScript caller cannot redirect the lookup.
      const args = {
        key,
        durability,
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      };
      const entry = await contract.getLedgerEntry(args);
      assertEquals(calls, 1);
      assertEquals(entry.type, "contractData");
      assertEquals(entry.key, "counter");
      assertEquals(entry.value, 42);
      assertEquals(entry.contractId, contractId);
      assertEquals(entry.durability, durability ?? "persistent");
      assertEquals(entry.keyScVal.toXdr("base64"), key.toXdr("base64"));
      assertEquals(entry.valueScVal.toXdr("base64"), value.toXdr("base64"));
      assertEquals(entry.lastModifiedLedgerSeq, 9);
      assertEquals(entry.liveUntilLedgerSeq, 100);
    }
  });

  it("preserves ledger not-found and RPC failures", async () => {
    const failure = new Error("RPC unavailable");
    let fail = false;
    const rpc = {
      getLedgerEntries: () => {
        if (fail) return Promise.reject(failure);
        return Promise.resolve({ entries: [], latestLedger: 10 });
      },
    } as unknown as Server;
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { contractId },
      rpc,
    });
    await assertRejects(
      () => contract.getLedgerEntry({ key }),
      LEDGER_ENTRY_NOT_FOUND,
    );
    fail = true;
    assertEquals(
      await assertRejects(() => contract.getLedgerEntry({ key })),
      failure,
    );
  });

  it("requires a bound contract ID before requesting ledger data", async () => {
    let calls = 0;
    const rpc = {
      getLedgerEntries: () => {
        calls++;
        return Promise.resolve({ entries: [], latestLedger: 10 });
      },
    } as unknown as Server;
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { wasmHash: "ab".repeat(32) },
      rpc,
    });
    await assertRejects(
      () => contract.getLedgerEntry({ key }),
      E.MISSING_REQUIRED_PROPERTY,
    );
    assertEquals(calls, 0);
  });
});
