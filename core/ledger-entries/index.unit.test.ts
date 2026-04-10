import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Address, Asset, Keypair, xdr } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";
import { NetworkConfig } from "@/network/index.ts";
import { StrKey } from "@/strkeys/index.ts";
import type { LedgerKeyLike } from "@/common/types/index.ts";
import {
  buildAccountLedgerKey,
  buildClaimableBalanceLedgerKey,
  buildConfigSettingLedgerKey,
  buildContractCodeLedgerKey,
  buildContractDataLedgerKey,
  buildContractInstanceLedgerKey,
  buildDataLedgerKey,
  buildLiquidityPoolLedgerKey,
  buildOfferLedgerKey,
  buildTrustlineLedgerKey,
  buildTtlLedgerKey,
  hashLedgerKey,
  LedgerEntries,
} from "@/ledger-entries/index.ts";
import { decodeLedgerEntry } from "@/ledger-entries/decode.ts";
import * as E from "@/ledger-entries/error.ts";
import type {
  ClaimableBalanceId,
  ContractId,
  Ed25519PublicKey,
  LiquidityPoolId,
  Sha256Hash,
} from "@/strkeys/types.ts";

const ACCOUNT_ID = Keypair.random().publicKey() as Ed25519PublicKey;
const SECOND_ACCOUNT_ID = Keypair.random().publicKey() as Ed25519PublicKey;
const ISSUER = Keypair.random().publicKey() as Ed25519PublicKey;
const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 9)) as ContractId;
const LIQUIDITY_POOL_ID = StrKey.encodeLiquidityPool(
  Buffer.alloc(32, 8),
) as LiquidityPoolId;
const CLAIMABLE_BALANCE_ID =
  "BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU" as ClaimableBalanceId;
const DATA_NAME = "profile";
const OFFER_ID = 17n;
const ASSET = new Asset("USD", ISSUER);

function makeRpc(entries: Api.LedgerEntryResult[]): Server {
  const byKey = new Map(
    entries.map((entry) => [entry.key.toXDR("base64"), entry]),
  );

  return {
    getLedgerEntries: (...keys: xdr.LedgerKey[]) =>
      Promise.resolve({
        entries: keys.flatMap((key) => {
          const entry = byKey.get(key.toXDR("base64"));
          return entry ? [entry] : [];
        }),
        latestLedger: 123456,
      }),
  } as unknown as Server;
}

function makeResult(
  key: LedgerKeyLike,
  val: xdr.LedgerEntryData,
  extras: Partial<Api.LedgerEntryResult> = {},
): Api.LedgerEntryResult {
  return {
    key: key as xdr.LedgerKey,
    val,
    ...extras,
  };
}

function makeAccountResult(): Api.LedgerEntryResult {
  const key = buildAccountLedgerKey({ accountId: ACCOUNT_ID });
  const val = xdr.LedgerEntryData.account(
    new xdr.AccountEntry({
      accountId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
      balance: xdr.Int64.fromString("1000"),
      seqNum: xdr.Int64.fromString("42"),
      numSubEntries: 3,
      inflationDest: Keypair.fromPublicKey(SECOND_ACCOUNT_ID).xdrAccountId(),
      flags: xdr.AccountFlags.authRequiredFlag().value |
        xdr.AccountFlags.authClawbackEnabledFlag().value,
      homeDomain: "colibri.dev",
      thresholds: Buffer.from([1, 2, 3, 4]),
      signers: [
        new xdr.Signer({
          key: xdr.SignerKey.signerKeyTypeEd25519(
            Keypair.fromPublicKey(ACCOUNT_ID).rawPublicKey(),
          ),
          weight: 10,
        }),
      ],
      ext: new xdr.AccountEntryExt(0),
    }),
  );

  return makeResult(key, val, { lastModifiedLedgerSeq: 10 });
}

function makeTrustlineResult(): Api.LedgerEntryResult {
  const key = buildTrustlineLedgerKey({ accountId: ACCOUNT_ID, asset: ASSET });
  const val = xdr.LedgerEntryData.trustline(
    new xdr.TrustLineEntry({
      accountId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
      asset: ASSET.toTrustLineXDRObject() as xdr.TrustLineAsset,
      balance: xdr.Int64.fromString("500"),
      limit: xdr.Int64.fromString("1000"),
      flags: xdr.TrustLineFlags.authorizedFlag().value,
      ext: new xdr.TrustLineEntryExt(
        1,
        new xdr.TrustLineEntryV1({
          liabilities: new xdr.Liabilities({
            buying: xdr.Int64.fromString("11"),
            selling: xdr.Int64.fromString("22"),
          }),
          ext: new xdr.TrustLineEntryV1Ext(0),
        }),
      ),
    }),
  );

  return makeResult(key, val);
}

function makeOfferResult(): Api.LedgerEntryResult {
  const key = buildOfferLedgerKey({
    sellerId: ACCOUNT_ID,
    offerId: OFFER_ID,
  });
  const val = xdr.LedgerEntryData.offer(
    new xdr.OfferEntry({
      sellerId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
      offerId: xdr.Int64.fromString(String(OFFER_ID)),
      selling: Asset.native().toXDRObject(),
      buying: ASSET.toXDRObject(),
      amount: xdr.Int64.fromString("77"),
      price: new xdr.Price({ n: 3, d: 2 }),
      flags: xdr.OfferEntryFlags.passiveFlag().value,
      ext: new xdr.OfferEntryExt(0),
    }),
  );

  return makeResult(key, val);
}

function makeDataResult(): Api.LedgerEntryResult {
  const key = buildDataLedgerKey({
    accountId: ACCOUNT_ID,
    dataName: DATA_NAME,
  });
  const val = xdr.LedgerEntryData.data(
    new xdr.DataEntry({
      accountId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
      dataName: DATA_NAME,
      dataValue: Buffer.from("hello"),
      ext: new xdr.DataEntryExt(0),
    }),
  );

  return makeResult(key, val);
}

function makeClaimableBalanceResult(): Api.LedgerEntryResult {
  const key = buildClaimableBalanceLedgerKey({
    balanceId: CLAIMABLE_BALANCE_ID,
  });
  const val = xdr.LedgerEntryData.claimableBalance(
    new xdr.ClaimableBalanceEntry({
      balanceId: xdr.ClaimableBalanceId.fromXDR(
        xdr.ClaimableBalanceId.claimableBalanceIdTypeV0(
          Buffer.from(StrKey.decodeClaimableBalance(CLAIMABLE_BALANCE_ID))
            .subarray(1),
        ).toXDR(),
      ),
      claimants: [
        xdr.Claimant.claimantTypeV0(
          new xdr.ClaimantV0({
            destination: Keypair.fromPublicKey(SECOND_ACCOUNT_ID)
              .xdrAccountId(),
            predicate: xdr.ClaimPredicate.claimPredicateBeforeRelativeTime(
              xdr.Int64.fromString("3600"),
            ),
          }),
        ),
      ],
      asset: Asset.native().toXDRObject(),
      amount: xdr.Int64.fromString("99"),
      ext: new xdr.ClaimableBalanceEntryExt(
        1,
        new xdr.ClaimableBalanceEntryExtensionV1({
          ext: new xdr.ClaimableBalanceEntryExtensionV1Ext(0),
          flags: xdr.ClaimableBalanceFlags.claimableBalanceClawbackEnabledFlag()
            .value,
        }),
      ),
    }),
  );

  return makeResult(key, val);
}

function makeLiquidityPoolResult(): Api.LedgerEntryResult {
  const key = buildLiquidityPoolLedgerKey({
    liquidityPoolId: LIQUIDITY_POOL_ID,
  });
  const val = xdr.LedgerEntryData.liquidityPool(
    new xdr.LiquidityPoolEntry({
      liquidityPoolId: Buffer.from(
        StrKey.decodeLiquidityPool(LIQUIDITY_POOL_ID),
      ) as unknown as xdr.PoolId,
      body: xdr.LiquidityPoolEntryBody.liquidityPoolConstantProduct(
        new xdr.LiquidityPoolEntryConstantProduct({
          params: new xdr.LiquidityPoolConstantProductParameters({
            assetA: Asset.native().toXDRObject(),
            assetB: ASSET.toXDRObject(),
            fee: 30,
          }),
          reserveA: xdr.Int64.fromString("100"),
          reserveB: xdr.Int64.fromString("200"),
          totalPoolShares: xdr.Int64.fromString("300"),
          poolSharesTrustLineCount: xdr.Int64.fromString("2"),
        }),
      ),
    }),
  );

  return makeResult(key, val);
}

function makeContractDataResult(): Api.LedgerEntryResult {
  const key = buildContractDataLedgerKey({
    contractId: CONTRACT_ID,
    key: xdr.ScVal.scvSymbol("greeting"),
  });
  const val = xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: new xdr.ExtensionPoint(0),
      contract: Address.fromString(CONTRACT_ID).toScAddress(),
      key: xdr.ScVal.scvSymbol("greeting"),
      durability: xdr.ContractDataDurability.persistent(),
      val: xdr.ScVal.scvString("hello"),
    }),
  );

  return makeResult(key, val, { liveUntilLedgerSeq: 999 });
}

function makeContractInstanceResult(
  executable: xdr.ContractExecutable = xdr.ContractExecutable
    .contractExecutableWasm(Buffer.from("ab".repeat(32), "hex")),
): Api.LedgerEntryResult {
  const key = buildContractInstanceLedgerKey({ contractId: CONTRACT_ID });
  const val = xdr.LedgerEntryData.contractData(
    new xdr.ContractDataEntry({
      ext: new xdr.ExtensionPoint(0),
      contract: Address.fromString(CONTRACT_ID).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
      val: xdr.ScVal.scvContractInstance(
        new xdr.ScContractInstance({
          executable,
          storage: [
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol("count"),
              val: xdr.ScVal.scvU32(7),
            }),
          ],
        }),
      ),
    }),
  );

  return makeResult(key, val);
}

function makeContractCodeResult(): Api.LedgerEntryResult {
  const key = buildContractCodeLedgerKey({ hash: "ab".repeat(32) });
  const val = xdr.LedgerEntryData.contractCode(
    new xdr.ContractCodeEntry({
      ext: new xdr.ContractCodeEntryExt(
        1,
        new xdr.ContractCodeEntryV1({
          ext: new xdr.ExtensionPoint(0),
          costInputs: new xdr.ContractCodeCostInputs({
            ext: new xdr.ExtensionPoint(0),
            nInstructions: 1,
            nFunctions: 2,
            nGlobals: 3,
            nTableEntries: 4,
            nTypes: 5,
            nDataSegments: 6,
            nElemSegments: 7,
            nImports: 8,
            nExports: 9,
            nDataSegmentBytes: 10,
          }),
        }),
      ),
      hash: Buffer.from("ab".repeat(32), "hex"),
      code: Buffer.from([1, 2, 3, 4]),
    }),
  );

  return makeResult(key, val);
}

function makeConfigSettingResult(): Api.LedgerEntryResult {
  const key = buildConfigSettingLedgerKey({
    configSettingId: "configSettingContractMaxSizeBytes",
  });
  const val = xdr.LedgerEntryData.configSetting(
    xdr.ConfigSettingEntry.configSettingContractMaxSizeBytes(65536),
  );

  return makeResult(key, val);
}

function makeTtlResult(): Api.LedgerEntryResult {
  const contractInstanceKey = buildContractInstanceLedgerKey({
    contractId: CONTRACT_ID,
  });
  const ttlHash = hashLedgerKey(contractInstanceKey) as Sha256Hash;
  const key = buildTtlLedgerKey({ keyHash: ttlHash });
  const val = xdr.LedgerEntryData.ttl(
    new xdr.TtlEntry({
      keyHash: Buffer.from(StrKey.decodeSha256Hash(ttlHash)),
      liveUntilLedgerSeq: 777,
    }),
  );

  return makeResult(key, val);
}

describe("LedgerEntries", () => {
  describe("constructor", () => {
    it("accepts a network config", () => {
      const ledger = new LedgerEntries({
        networkConfig: NetworkConfig.CustomNet({
          networkPassphrase: "Standalone Network ; February 2017",
          rpcUrl: "http://localhost:8000",
          allowHttp: true,
        }),
      });

      assertExists(ledger.rpc);
    });

    it("accepts a preconfigured rpc instance", () => {
      const rpc = makeRpc([]);
      const ledger = new LedgerEntries({ rpc });

      assertEquals(ledger.rpc, rpc);
    });

    it("throws when both constructor styles are provided", () => {
      assertThrows(
        () =>
          new LedgerEntries({
            rpc: makeRpc([]),
            networkConfig: NetworkConfig.TestNet(),
          } as never),
        E.INVALID_CONSTRUCTOR_ARGS,
      );
    });

    it("throws when the network config has no rpc url", () => {
      assertThrows(
        () =>
          new LedgerEntries({
            networkConfig: NetworkConfig.CustomNet({
              networkPassphrase: "Standalone Network ; February 2017",
            }),
          }),
        E.MISSING_RPC_URL,
      );
    });
  });

  describe("public api", () => {
    it("defaults allowHttp to false and supports empty batch reads", async () => {
      const withNetworkConfig = new LedgerEntries({
        networkConfig: NetworkConfig.CustomNet({
          networkPassphrase: "Standalone Network ; February 2017",
          rpcUrl: "https://rpc.example.com",
        }),
      });
      const withRpc = new LedgerEntries({
        rpc: {
          getLedgerEntries: () => Promise.resolve({
            entries: [],
            latestLedger: 1,
          }),
        } as unknown as Server,
      });

      const entries = await withRpc.getMany([] as const);

      assertExists(withNetworkConfig.rpc);
      assertEquals(entries, []);
    });

    it("accepts ledger keys whose base64 serialization returns bytes", async () => {
      const responseKey = buildAccountLedgerKey({
        accountId: ACCOUNT_ID,
      }) as unknown as xdr.LedgerKey;
      const requestKey = buildAccountLedgerKey({
        accountId: ACCOUNT_ID,
      }) as unknown as xdr.LedgerKey;
      const originalToXdr = requestKey.toXDR.bind(requestKey);
      const accountEntry = new xdr.AccountEntry({
        accountId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
        balance: xdr.Int64.fromString("10"),
        seqNum: xdr.Int64.fromString("1"),
        numSubEntries: 0,
        inflationDest: null,
        flags: 0,
        homeDomain: "",
        thresholds: Buffer.from([0, 0, 0, 0]),
        signers: [],
        ext: new xdr.AccountEntryExt(0),
      });

      Object.defineProperty(requestKey, "toXDR", {
        value: (format?: "raw" | "hex" | "base64") => {
          if (format === "base64") {
            return new TextEncoder().encode(String(originalToXdr("base64")));
          }

          if (format === "hex") {
            return originalToXdr("hex");
          }

          return originalToXdr("raw");
        },
      });

      const ledger = new LedgerEntries({
        rpc: {
          getLedgerEntries: () => Promise.resolve({
            entries: [
              makeResult(
                responseKey,
                xdr.LedgerEntryData.account(accountEntry),
              ),
            ],
            latestLedger: 1,
          }),
        } as unknown as Server,
      });

      const [entry] = await ledger.getMany([requestKey] as const);

      assertEquals(entry?.type, "account");
      if (!entry || entry.type !== "account") {
        throw new Error("expected account entry");
      }
      assertEquals(entry.balance, 10n);
    });

    it("accepts ledger keys whose serializer returns raw bytes for base64 requests", async () => {
      const responseKey = buildAccountLedgerKey({
        accountId: ACCOUNT_ID,
      }) as unknown as xdr.LedgerKey;
      const requestKey = buildAccountLedgerKey({
        accountId: ACCOUNT_ID,
      }) as unknown as xdr.LedgerKey;
      const originalToXdr = requestKey.toXDR.bind(requestKey);
      const accountEntry = new xdr.AccountEntry({
        accountId: Keypair.fromPublicKey(ACCOUNT_ID).xdrAccountId(),
        balance: xdr.Int64.fromString("10"),
        seqNum: xdr.Int64.fromString("1"),
        numSubEntries: 0,
        inflationDest: null,
        flags: 0,
        homeDomain: "",
        thresholds: Buffer.from([0, 0, 0, 0]),
        signers: [],
        ext: new xdr.AccountEntryExt(0),
      });

      Object.defineProperty(requestKey, "toXDR", {
        value: (format?: "raw" | "hex" | "base64") => {
          if (format === "base64") {
            return originalToXdr("raw");
          }

          if (format === "hex") {
            return originalToXdr("hex");
          }

          return originalToXdr("raw");
        },
      });

      const ledger = new LedgerEntries({
        rpc: {
          getLedgerEntries: () => Promise.resolve({
            entries: [
              makeResult(
                responseKey,
                xdr.LedgerEntryData.account(accountEntry),
              ),
            ],
            latestLedger: 1,
          }),
        } as unknown as Server,
      });

      const [entry] = await ledger.getMany([requestKey] as const);

      assertEquals(entry?.type, "account");
      if (!entry || entry.type !== "account") {
        throw new Error("expected account entry");
      }
      assertEquals(entry.balance, 10n);
    });
  });

  describe("key builders", () => {
    it("builds all supported ledger-key variants", () => {
      const account = buildAccountLedgerKey({ accountId: ACCOUNT_ID });
      const trustline = buildTrustlineLedgerKey({
        accountId: ACCOUNT_ID,
        asset: ASSET,
      });
      const offer = buildOfferLedgerKey({
        sellerId: ACCOUNT_ID,
        offerId: OFFER_ID,
      });
      const data = buildDataLedgerKey({
        accountId: ACCOUNT_ID,
        dataName: DATA_NAME,
      });
      const claimableBalance = buildClaimableBalanceLedgerKey({
        balanceId: CLAIMABLE_BALANCE_ID,
      });
      const liquidityPool = buildLiquidityPoolLedgerKey({
        liquidityPoolId: LIQUIDITY_POOL_ID,
      });
      const contractData = buildContractDataLedgerKey({
        contractId: CONTRACT_ID,
        key: xdr.ScVal.scvSymbol("hello"),
      });
      const contractInstance = buildContractInstanceLedgerKey({
        contractId: CONTRACT_ID,
      });
      const contractCode = buildContractCodeLedgerKey({
        hash: "ab".repeat(32),
      });
      const configSetting = buildConfigSettingLedgerKey({
        configSettingId: "configSettingContractMaxSizeBytes",
      });
      const ttl = buildTtlLedgerKey({ key: contractInstance });

      assertEquals(account.switch().name, "account");
      assertEquals(trustline.switch().name, "trustline");
      assertEquals(offer.switch().name, "offer");
      assertEquals(data.switch().name, "data");
      assertEquals(claimableBalance.switch().name, "claimableBalance");
      assertEquals(liquidityPool.switch().name, "liquidityPool");
      assertEquals(contractData.switch().name, "contractData");
      assertEquals(contractInstance.switch().name, "contractData");
      assertEquals(contractCode.switch().name, "contractCode");
      assertEquals(configSetting.switch().name, "configSetting");
      assertEquals(ttl.switch().name, "ttl");
    });

    it("validates string inputs on the builders", () => {
      assertThrows(
        () => buildAccountLedgerKey({ accountId: "BAD" as Ed25519PublicKey }),
        E.INVALID_ACCOUNT_ID,
      );
      assertThrows(
        () =>
          buildClaimableBalanceLedgerKey({
            balanceId: "BAD" as ClaimableBalanceId,
          }),
        E.INVALID_CLAIMABLE_BALANCE_ID,
      );
      assertThrows(
        () =>
          buildLiquidityPoolLedgerKey({
            liquidityPoolId: "BAD" as LiquidityPoolId,
          }),
        E.INVALID_LIQUIDITY_POOL_ID,
      );
      assertThrows(
        () =>
          buildContractCodeLedgerKey({
            hash: "not-hex",
          }),
        E.INVALID_HEX_HASH,
      );
    });
  });

  describe("decoding", () => {
    const entries = [
      makeAccountResult(),
      makeTrustlineResult(),
      makeOfferResult(),
      makeDataResult(),
      makeClaimableBalanceResult(),
      makeLiquidityPoolResult(),
      makeContractDataResult(),
      makeContractInstanceResult(),
      makeContractCodeResult(),
      makeConfigSettingResult(),
      makeTtlResult(),
    ];

    const ledger = new LedgerEntries({ rpc: makeRpc(entries) });

    it("decodes account entries", async () => {
      const entry = await ledger.account({ accountId: ACCOUNT_ID });

      assertEquals(entry.type, "account");
      assertEquals(entry.accountId, ACCOUNT_ID);
      assertEquals(entry.balance, 1000n);
      assertEquals(entry.sequenceNumber, 42n);
      assertEquals(entry.flags.authRequired, true);
      assertEquals(entry.flags.authClawbackEnabled, true);
      assertEquals(entry.thresholds.high, 4);
      assertEquals(entry.signers[0].key.type, "ed25519");
      assertExists(entry.xdr.key);
    });

    it("decodes trustline entries", async () => {
      const entry = await ledger.trustline({
        accountId: ACCOUNT_ID,
        asset: ASSET,
      });

      assertEquals(entry.type, "trustline");
      assertEquals(entry.balance, 500n);
      assertEquals(entry.limit, 1000n);
      assertEquals(entry.flags.authorized, true);
      assertEquals(entry.liabilities?.selling, 22n);
    });

    it("decodes offer entries", async () => {
      const entry = await ledger.offer({
        sellerId: ACCOUNT_ID,
        offerId: OFFER_ID,
      });

      assertEquals(entry.type, "offer");
      assertEquals(entry.offerId, OFFER_ID);
      assertEquals(entry.amount, 77n);
      assertEquals(entry.price.n, 3);
      assertEquals(entry.flags.passive, true);
    });

    it("decodes data entries", async () => {
      const entry = await ledger.data({
        accountId: ACCOUNT_ID,
        dataName: DATA_NAME,
      });

      assertEquals(entry.type, "data");
      assertEquals(entry.dataName, DATA_NAME);
      assertEquals(new TextDecoder().decode(entry.dataValue), "hello");
    });

    it("decodes claimable balance entries", async () => {
      const entry = await ledger.claimableBalance({
        balanceId: CLAIMABLE_BALANCE_ID,
      });

      assertEquals(entry.type, "claimableBalance");
      assertEquals(entry.balanceId, CLAIMABLE_BALANCE_ID);
      assertEquals(entry.amount, 99n);
      assertEquals(entry.flags.clawbackEnabled, true);
      assertEquals(entry.claimants[0].predicate.type, "beforeRelativeTime");
    });

    it("decodes liquidity pool entries", async () => {
      const entry = await ledger.liquidityPool({
        liquidityPoolId: LIQUIDITY_POOL_ID,
      });

      assertEquals(entry.type, "liquidityPool");
      assertEquals(entry.liquidityPoolId, LIQUIDITY_POOL_ID);
      assertEquals(entry.reserveA, 100n);
      assertEquals(entry.poolSharesTrustLineCount, 2n);
    });

    it("decodes generic contract data entries", async () => {
      const entry = await ledger.contractData({
        contractId: CONTRACT_ID,
        key: xdr.ScVal.scvSymbol("greeting"),
      });

      assertEquals(entry.type, "contractData");
      assertEquals(entry.contractId, CONTRACT_ID);
      assertEquals(entry.durability, "persistent");
      assertEquals(entry.key, "greeting");
      assertEquals(entry.value, "hello");
      assertEquals(entry.liveUntilLedgerSeq, 999);
    });

    it("decodes contract instance entries", async () => {
      const entry = await ledger.contractInstance({ contractId: CONTRACT_ID });

      assertEquals(entry.type, "contractInstance");
      assertEquals(entry.contractId, CONTRACT_ID);
      assertEquals(entry.executable.type, "wasm");
      assertEquals((entry.storage as Record<string, unknown>)["count"], 7);
    });

    it("decodes contract code entries", async () => {
      const entry = await ledger.contractCode({ hash: "ab".repeat(32) });

      assertEquals(entry.type, "contractCode");
      assertEquals(entry.hash, "ab".repeat(32));
      assertEquals(entry.code.length, 4);
      assertExists(entry.costInputs);
    });

    it("can resolve contract code from a contract instance", async () => {
      const entry = await ledger.contractCode({ contractId: CONTRACT_ID });

      assertEquals(entry.type, "contractCode");
      assertEquals(entry.hash, "ab".repeat(32));
    });

    it("decodes config setting entries", async () => {
      const entry = await ledger.configSetting({
        configSettingId: "configSettingContractMaxSizeBytes",
      });

      assertEquals(entry.type, "configSetting");
      assertEquals(entry.configSettingId, "configSettingContractMaxSizeBytes");
      assertEquals(entry.value, 65536);
    });

    it("decodes ttl entries", () => {
      const ttlHash = hashLedgerKey(
        buildContractInstanceLedgerKey({ contractId: CONTRACT_ID }),
      ) as Sha256Hash;
      const entry = decodeLedgerEntry(makeTtlResult());

      assertEquals(entry.type, "ttl");
      assert(entry.type === "ttl");
      assertEquals(entry.keyHash, ttlHash);
      assertEquals(entry.expiresAtLedger, 777);
    });

    it("preserves order and nulls in getMany", async () => {
      const missingKey = buildDataLedgerKey({
        accountId: SECOND_ACCOUNT_ID,
        dataName: "missing",
      });
      const [account, missing, configSetting] = await ledger.getMany(
        [
          buildAccountLedgerKey({ accountId: ACCOUNT_ID }),
          missingKey,
          buildConfigSettingLedgerKey({
            configSettingId: "configSettingContractMaxSizeBytes",
          }),
        ] as const,
      );

      assertEquals(account?.type, "account");
      assertEquals(missing, null);
      assertEquals(configSetting?.type, "configSetting");
    });
  });

  describe("errors", () => {
    it("throws not found for convenience methods", async () => {
      const ledger = new LedgerEntries({ rpc: makeRpc([]) });

      await assertRejects(
        () => ledger.account({ accountId: ACCOUNT_ID }),
        E.LEDGER_ENTRY_NOT_FOUND,
      );
    });

    it("returns null for missing generic reads", async () => {
      const ledger = new LedgerEntries({ rpc: makeRpc([]) });

      const entry = await ledger.get(
        buildAccountLedgerKey({ accountId: ACCOUNT_ID }),
      );

      assertEquals(entry, null);
    });

    it("throws when resolving contract code from a non-wasm contract instance", async () => {
      const ledger = new LedgerEntries({
        rpc: makeRpc([
          makeContractInstanceResult(
            xdr.ContractExecutable.contractExecutableStellarAsset(),
          ),
        ]),
      });

      await assertRejects(
        () => ledger.contractCode({ contractId: CONTRACT_ID }),
        E.CONTRACT_INSTANCE_HAS_NO_WASM_HASH,
      );
    });

    it("throws when ttl entries are requested through generic reads", async () => {
      const ledger = new LedgerEntries({ rpc: makeRpc([]) });

      await assertRejects(
        () =>
          ledger.get(
            buildTtlLedgerKey({
              key: buildContractInstanceLedgerKey({ contractId: CONTRACT_ID }),
            }),
          ),
        E.UNSUPPORTED_RPC_LEDGER_KEY,
      );
    });
  });
});
