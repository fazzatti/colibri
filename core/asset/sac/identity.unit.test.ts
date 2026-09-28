import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { stub } from "@std/testing/mock";
import { Address, Asset, Keypair, nativeToScVal, xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { StellarAssetContract } from "@/asset/sac/index.ts";
import * as ERROR from "@/asset/sac/error.ts";
import * as LEDGER_ERROR from "@/ledger-entries/error.ts";
import { buildContractInstanceLedgerKey } from "@/ledger-entries/keys.ts";
import { NetworkConfig } from "@/network/index.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const networkConfig = NetworkConfig.TestNet();
const issuer = Keypair.random().publicKey() as Ed25519PublicKey;
const asset = new Asset("USDC", issuer);
const contractId = asset.contractId(
  networkConfig.networkPassphrase,
) as ContractId;
const otherAdmin = new Asset("ADMIN", issuer).contractId(
  networkConfig.networkPassphrase,
);

const metadataEntry = (metadata: unknown): xdr.ScMapEntry =>
  new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol("METADATA"),
    val: nativeToScVal(metadata),
  });

function mockRpc(
  id: ContractId,
  storage: xdr.ScMapEntry[] | null,
  executable: xdr.ContractExecutable = xdr.ContractExecutable
    .contractExecutableStellarAsset(),
) {
  const key = buildContractInstanceLedgerKey({
    contractId: id,
  }) as xdr.LedgerKey;
  let reads = 0;
  const response = {
    latestLedger: 123,
    entries: [{
      key,
      val: xdr.LedgerEntryData.contractData(
        new xdr.ContractDataEntry({
          ext: xdr.ExtensionPoint.v0(),
          contract: Address.fromString(id).toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent,
          val: xdr.ScVal.scvContractInstance(
            new xdr.ScContractInstance({ executable, storage }),
          ),
        }),
      ),
      lastModifiedLedgerSeq: 120,
      liveUntilLedgerSeq: 999,
    }],
  };
  const getLedgerEntries = (...keys: xdr.LedgerKey[]) => {
    reads++;
    assertEquals(keys.map((k) => k.toXdr("base64")), [key.toXdr("base64")]);
    return Promise.resolve(response);
  };
  return {
    rpc: { getLedgerEntries } as unknown as Server,
    getLedgerEntries,
    reads: () => reads,
  };
}

function storageFor(canonical: string, withAdmin = true): xdr.ScMapEntry[] {
  return [
    metadataEntry({
      name: canonical,
      decimal: 7,
      symbol: canonical.split(":")[0],
    }),
    ...(withAdmin
      ? [
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Admin")]),
          val: nativeToScVal(otherAdmin, { type: "address" }),
        }),
      ]
      : []),
  ];
}

describe("SAC identity resolution", () => {
  for (const code of ["USD", "LONGASSET123", "XLM"]) {
    it(`resolves issued ${code} independently of its contract admin in one read`, async () => {
      const expected = new Asset(code, issuer);
      const id = expected.contractId(
        networkConfig.networkPassphrase,
      ) as ContractId;
      const fixture = mockRpc(id, storageFor(`${code}:${issuer}`));
      const sac = await StellarAssetContract.fromContractId({
        contractId: id,
        networkConfig,
        rpc: fixture.rpc,
      });
      assertEquals(sac.code, code);
      assertEquals(sac.issuer, issuer);
      assertEquals(sac.contractId, id);
      assertEquals(sac.isNativeXLM(), false);
      assertStrictEquals(sac.contract.rpc, fixture.rpc);
      assertEquals(fixture.reads(), 1);
    });
  }

  for (const withAdmin of [false, true]) {
    it(`resolves native identity with ${withAdmin ? "mixed" : "string"} storage keys`, async () => {
      const id = Asset.native().contractId(
        networkConfig.networkPassphrase,
      ) as ContractId;
      const { rpc } = mockRpc(id, storageFor("native", withAdmin));
      const sac = await StellarAssetContract.fromContractId({
        contractId: id,
        networkConfig,
        rpc,
      });
      assertEquals(sac.code, "XLM");
      assertEquals(sac.issuer, "native");
      assertEquals(sac.isNativeXLM(), true);
    });
  }

  it("uses the configured network RPC when no client is supplied", async () => {
    const fixture = mockRpc(contractId, storageFor(`USDC:${issuer}`));
    using request = stub(
      Server.prototype,
      "getLedgerEntries",
      fixture.getLedgerEntries,
    );
    const sac = await StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
    });
    assertEquals(sac.issuer, issuer);
    assertEquals(request.calls.length, 1);
  });

  it("retains the caller's descriptive-read cache option", async () => {
    const { rpc } = mockRpc(contractId, storageFor(`USDC:${issuer}`));
    const sac = await StellarAssetContract.fromContractId({
      contractId,
      networkConfig,
      rpc,
      options: { cache: { enabled: false } },
    });
    using read = stub(
      sac.contract,
      "readRaw",
      () => Promise.resolve(nativeToScVal(`USDC:${issuer}`)),
    );
    await sac.name();
    await sac.name();
    assertEquals(read.calls.length, 2);
  });

  for (
    const executable of [
      xdr.ContractExecutable.contractExecutableWasm(new Uint8Array(32)),
      xdr.ContractExecutable.contractExecutableExternalRef(
        new xdr.ContractExecutableExternalRef({
          executableOwner: Address.fromString(otherAdmin).toScAddress(),
          tag: new Uint8Array([1]),
        }),
      ),
    ]
  ) {
    it(`rejects ${executable.type} even if it claims SAC metadata`, async () => {
      const { rpc } = mockRpc(
        contractId,
        storageFor(`USDC:${issuer}`),
        executable,
      );
      const error = await assertRejects(
        () =>
          StellarAssetContract.fromContractId({
            contractId,
            networkConfig,
            rpc,
          }),
        ERROR.NOT_STELLAR_ASSET_CONTRACT,
      );
      assertEquals(error.code, ERROR.Code.NOT_STELLAR_ASSET_CONTRACT);
      assertEquals(
        (error.meta.data as { contractId: string }).contractId,
        contractId,
      );
      assertStrictEquals(
        ERROR.ERROR_CONTR[ERROR.Code.NOT_STELLAR_ASSET_CONTRACT],
        ERROR.NOT_STELLAR_ASSET_CONTRACT,
      );
    });
  }

  const malformed: [string, xdr.ScMapEntry[] | null][] = [
    ["missing storage", null],
    ["empty storage", []],
    ["null metadata", [metadataEntry(null)]],
    ["array metadata", [metadataEntry(["native"])]],
    ["missing name", [metadataEntry({ symbol: "USDC" })]],
    ["non-string name", [metadataEntry({ name: 7 })]],
    ["invalid issuer", storageFor("USDC:GARBAGE")],
    ["invalid code", storageFor(`TOO_LONG_ASSET:${issuer}`)],
    ["non-canonical name", storageFor("USD Coin")],
    ["metadata with non-string keys", [
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("METADATA"),
        val: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvU32(1),
            val: nativeToScVal("native"),
          }),
        ]),
      }),
    ]],
  ];
  for (const [label, storage] of malformed) {
    it(`rejects ${label} without creating a partial client`, async () => {
      const { rpc } = mockRpc(contractId, storage);
      const error = await assertRejects(
        () =>
          StellarAssetContract.fromContractId({
            contractId,
            networkConfig,
            rpc,
          }),
        ERROR.INVALID_ASSET_METADATA,
      );
      assertEquals(error.code, ERROR.Code.INVALID_ASSET_METADATA);
      assertEquals(
        (error.meta.data as { contractId: string }).contractId,
        contractId,
      );
      assertStrictEquals(
        ERROR.ERROR_CONTR[ERROR.Code.INVALID_ASSET_METADATA],
        ERROR.INVALID_ASSET_METADATA,
      );
    });
  }

  for (
    const canonical of [
      `WRONG:${issuer}`,
      `USDC:${Keypair.random().publicKey()}`,
      "native",
    ]
  ) {
    it(`rejects an identity that derives another id (${canonical})`, async () => {
      const { rpc } = mockRpc(contractId, storageFor(canonical));
      const error = await assertRejects(
        () =>
          StellarAssetContract.fromContractId({
            contractId,
            networkConfig,
            rpc,
          }),
        ERROR.UNMATCHED_CONTRACT_ID,
      );
      assertEquals(
        (error.meta.data as { expected: string }).expected,
        contractId,
      );
    });
  }

  it("rejects an RPC response for a different network passphrase", async () => {
    const { rpc } = mockRpc(contractId, storageFor(`USDC:${issuer}`));
    await assertRejects(
      () =>
        StellarAssetContract.fromContractId({
          contractId,
          networkConfig: NetworkConfig.MainNet(),
          rpc,
        }),
      ERROR.UNMATCHED_CONTRACT_ID,
    );
  });

  it("preserves the missing-entry error for unavailable or archived instances", async () => {
    const rpc = {
      getLedgerEntries: () =>
        Promise.resolve({ entries: [], latestLedger: 123 }),
    } as unknown as Server;
    await assertRejects(
      () =>
        StellarAssetContract.fromContractId({ contractId, networkConfig, rpc }),
      LEDGER_ERROR.LEDGER_ENTRY_NOT_FOUND,
    );
  });

  it("preserves an RPC failure rather than returning an incomplete client", async () => {
    const failure = new Error("RPC unavailable");
    const rpc = {
      getLedgerEntries: () => Promise.reject(failure),
    } as unknown as Server;
    const error = await assertRejects(
      () =>
        StellarAssetContract.fromContractId({ contractId, networkConfig, rpc }),
      Error,
    );
    assertStrictEquals(error, failure);
  });
});
