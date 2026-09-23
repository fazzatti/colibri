import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  Account,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";
import {
  calculateResourcePadding,
  getNetworkResourceSettings,
} from "@/resources/index.ts";
import type {
  NetworkResourceSettings,
  ResourcePaddingRequest,
  ResourceSettingsRpc,
} from "@/resources/types.ts";
import type { TransactionResources } from "@/common/types/transaction-config/resources.ts";
import { applyResourceConfig } from "@/resources/policy.ts";
import * as ERROR from "@/resources/error.ts";
import * as ASSEMBLY_ERROR from "@/processes/assemble-transaction/error.ts";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import { inputToBuild } from "@/pipelines/classic-transaction/connectors.ts";
import { NetworkConfig } from "@/network/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const network = NetworkConfig.TestNet();
const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";
const transaction = () =>
  new TransactionBuilder(new Account(source, "100"), {
    fee: "100",
    networkPassphrase: network.networkPassphrase,
  }).addOperation(Operation.invokeContractFunction({
    contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    function: "test",
    args: [],
  })).setTimeout(0).build();
const data = () =>
  new SorobanDataBuilder().setResources(10_001, 1025, 1616).setResourceFee(
    "29390",
  );
const settings: NetworkResourceSettings = {
  networkPassphrase: network.networkPassphrase,
  protocolVersion: 27,
  latestLedger: 102,
  limits: {
    instructions: 100_000_000,
    diskReadBytes: 100_000,
    writeBytes: 100_000,
    memoryBytes: 40_000_000,
    footprintEntries: 100,
  },
  fees: {
    perInstructionIncrement: "100",
    perDiskRead1KB: "10",
    perWrite1KB: "1000",
  },
};

describe("resource overrides and padding", () => {
  it("clones resource data, rounds percentage additions upward and leaves unrelated dimensions intact", () => {
    const original = data().build();
    const before = original.toXdr("base64");
    const result = applyResourceConfig(original, {
      override: { instructions: 12_000_000 },
      padding: {
        writeBytes: { percent: 0.5 },
        resourceFee: { amount: "5000" },
      },
    });
    assertEquals(result.resources.instructions, 12_000_000);
    assertEquals(result.resources.diskReadBytes, 1025);
    assertEquals(result.resources.writeBytes, 1625);
    assertEquals(result.resourceFee, 34390n);
    assertEquals(original.toXdr("base64"), before);
    assertEquals(
      result.resources.footprint.toXdr("base64"),
      original.resources.footprint.toXdr("base64"),
    );
  });

  it("handles zero, scientific notation, tiny percentages and fixed additions exactly", () => {
    const original = data().build();
    assertEquals(
      applyResourceConfig(original, {}).toXdr("base64"),
      original.toXdr("base64"),
    );
    assertEquals(
      applyResourceConfig(original, {
        padding: {
          writeBytes: { amount: 10 },
          diskReadBytes: { percent: 0 },
          instructions: { percent: 1e-7 },
        },
      }).resources.instructions,
      10002,
    );
    assertEquals(
      applyResourceConfig(original, {
        padding: { resourceFee: { percent: 10 } },
      }).resourceFee,
      32329n,
    );
    assertEquals(
      applyResourceConfig(new SorobanDataBuilder().build(), {
        padding: { instructions: { percent: 1e21 } },
      }).resources.instructions,
      0,
    );
    assertEquals(
      applyResourceConfig(original, { override: { resourceFee: "30000" } })
        .resourceFee,
      30000n,
    );
  });

  it("rejects a 12-million override against a 13-million recommendation with useful metadata", () => {
    const error = assertThrows(
      () =>
        applyResourceConfig(
          new SorobanDataBuilder().setResources(13_000_000, 0, 0).build(),
          { override: { instructions: 12_000_000 } },
        ),
      ERROR.BELOW_RECOMMENDATION,
    );
    assertEquals(error.meta?.data, {
      resource: "instructions",
      configured: "12000000",
      recommended: "13000000",
    });
  });

  it("rejects ambiguous, negative, fractional, unsafe and unknown configuration", () => {
    const invalid: unknown[] = [
      null,
      [],
      { other: 1 },
      { padding: null },
      { override: [] },
      { padding: { refundableFee: { amount: "1" } } },
      {
        override: { instructions: 20_000 },
        padding: { instructions: { amount: 10 } },
      },
      ...[-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "5"].map((
        instructions,
      ) => ({ override: { instructions } })),
      ...[
        {},
        { amount: 1, percent: 2 },
        { percent: -1 },
        { percent: Infinity },
        { percent: "10" },
        { amount: -1 },
        { amount: 1, typo: true },
      ].map((writeBytes) => ({ padding: { writeBytes } })),
      ...[3, "-1", "1.5", "1e5", "", " 1"].map((resourceFee) => ({
        override: { resourceFee },
      })),
    ];
    for (const config of invalid) {
      assertThrows(
        () =>
          applyResourceConfig(data().build(), config as TransactionResources),
        ERROR.INVALID_CONFIGURATION,
      );
    }
  });

  it("rejects overflow, missing simulation and insufficient fee overrides", () => {
    assertThrows(
      () => applyResourceConfig(undefined, {}),
      ERROR.MISSING_SIMULATION,
    );
    assertThrows(
      () =>
        applyResourceConfig(data().build(), { override: { resourceFee: "1" } }),
      ERROR.BELOW_RECOMMENDATION,
    );
    for (
      const resources of [
        { padding: { writeBytes: { percent: 1e21 } } },
        { override: { instructions: 0x1_0000_0000 } },
        { override: { resourceFee: "4294967296" } },
      ]
    ) {
      assertThrows(
        () => applyResourceConfig(data().build(), resources),
        ERROR.LIMIT_EXCEEDED,
      );
    }
  });

  it("assembles adjusted data once, preserves inclusion, and enforces the total-fee cap", async () => {
    const sorobanData = data();
    const result = await assembleTransaction({
      transaction: transaction(),
      sorobanData,
      resources: {
        padding: { writeBytes: { amount: 10 }, resourceFee: { amount: "100" } },
      },
    });
    assertEquals(result.fee, "29590");
    assertEquals(sorobanData.build().resourceFee, 29390n);
    await assertRejects(
      () =>
        assembleTransaction({
          transaction: transaction(),
          sorobanData,
          resources: { override: { instructions: 1 } },
        }),
      ERROR.BELOW_RECOMMENDATION,
    );
    await assertRejects(
      () =>
        assembleTransaction({
          transaction: transaction(),
          sorobanData,
          resourceFee: "50000",
          resources: {},
        }),
      ERROR.INVALID_CONFIGURATION,
    );
    await assertRejects(
      () =>
        assembleTransaction({
          transaction: transaction(),
          sorobanData,
          resources: {},
          transactionFee: { max: "29400" },
        }),
      ASSEMBLY_ERROR.MAX_FEE_TOO_LOW_ERROR,
    );
    await assertRejects(
      () =>
        assembleTransaction({
          transaction: transaction(),
          sorobanData,
          resources: { override: { resourceFee: "4294967295" } },
        }),
      ASSEMBLY_ERROR.TRANSACTION_FEE_TOO_HIGH_ERROR,
    );
  });

  it("rejects resource configuration on the Classic pipeline before RPC access", () => {
    const build = inputToBuild({} as Server, network.networkPassphrase);
    assertThrows(
      () =>
        build({
          operations: [],
          config: {
            source,
            fee: "100",
            timeout: 30,
            signers: [],
            resources: {},
          },
        }),
      ERROR.UNSUPPORTED_TRANSACTION,
    );
  });
});

describe("external resource calculator", () => {
  it("prices rounded total differences and folds refundable allowance into the total exactly once", () => {
    const original = data();
    const simulation = { latestLedger: 100, transactionData: original };
    const quote = calculateResourcePadding({
      simulation,
      settings,
      padding: {
        instructions: { percent: 10 },
        writeBytes: { amount: 10 },
        refundableFee: { amount: "5000" },
      },
    });
    assertEquals(quote.padding, {
      instructions: { amount: 1001 },
      diskReadBytes: { amount: 0 },
      writeBytes: { amount: 10 },
      resourceFee: { amount: "5019" },
    });
    assertEquals(quote.breakdown, {
      nonRefundableFee: "19",
      refundableFee: "5000",
      resourceFee: "5019",
    });
    assertEquals(quote.simulationDataXdr, original.build().toXdr("base64"));
    assertEquals([
      quote.simulationLedger,
      quote.settingsLedger,
      quote.protocolVersion,
    ], [100, 102, 27]);
    assertEquals(quote.networkPassphrase, network.networkPassphrase);
    assertEquals(
      applyResourceConfig(original.build(), { padding: quote.padding })
        .resourceFee,
      34409n,
    );
  });

  it("does not overcharge a marginal byte when rounded cost stays unchanged", () => {
    const quote = calculateResourcePadding({
      simulation: {
        latestLedger: 100,
        transactionData: new SorobanDataBuilder().setResources(0, 0, 1023)
          .setResourceFee(1),
      },
      settings: { ...settings, fees: { ...settings.fees, perWrite1KB: "1" } },
      padding: { writeBytes: { amount: 1 } },
    });
    assertEquals(quote.breakdown.resourceFee, "0");
  });

  it("supports extra refundable percentages of the total simulated resource fee", () => {
    const quote = calculateResourcePadding({
      simulation: { latestLedger: 100, transactionData: data() },
      settings,
      padding: {
        refundableFee: { percent: 10 },
        diskReadBytes: { amount: 1024 },
      },
    });
    assertEquals(quote.breakdown, {
      nonRefundableFee: "10",
      refundableFee: "2939",
      resourceFee: "2949",
    });
  });

  it("validates network ceilings, fee rates, aggregate overflow and input shape", () => {
    const input = {
      simulation: { latestLedger: 100, transactionData: data() },
      settings,
      padding: {},
    };
    assertThrows(
      () =>
        calculateResourcePadding({
          ...input,
          settings: {
            ...settings,
            limits: { ...settings.limits, writeBytes: 1000 },
          },
        }),
      ERROR.LIMIT_EXCEEDED,
    );
    assertThrows(
      () =>
        calculateResourcePadding({
          ...input,
          settings: {
            ...settings,
            fees: { ...settings.fees, perWrite1KB: "-1" },
          },
        }),
      ERROR.INVALID_CONFIGURATION,
    );
    assertThrows(
      () =>
        calculateResourcePadding({
          ...input,
          padding: { resourceFee: { amount: "10" } } as ResourcePaddingRequest,
        }),
      ERROR.INVALID_CONFIGURATION,
    );
    assertThrows(
      () =>
        calculateResourcePadding({
          ...input,
          padding: { refundableFee: { amount: "4294967295" } },
        }),
      ERROR.LIMIT_EXCEEDED,
    );
    assertThrows(
      () => calculateResourcePadding({ ...input, simulation: undefined! }),
      ERROR.MISSING_SIMULATION,
    );
    assertThrows(
      () =>
        calculateResourcePadding({
          ...input,
          settings: {
            ...settings,
            fees: { ...settings.fees, perWrite1KB: "9223372036854775808" },
          },
        }),
      ERROR.LIMIT_EXCEEDED,
    );
    assertThrows(
      () =>
        calculateResourcePadding({
          ...input,
          settings: {
            ...settings,
            fees: { ...settings.fees, perWrite1KB: "9223372036854775807" },
          },
        }),
      ERROR.BELOW_RECOMMENDATION,
    );
    assertThrows(
      () =>
        applyResourceConfig(
          new SorobanDataBuilder().setResourceFee(-1).build(),
          {},
        ),
      ERROR.INVALID_CONFIGURATION,
    );
  });
});

function settingEntries(): Api.LedgerEntryResult[] {
  const values = [
    xdr.ConfigSettingEntry.configSettingContractComputeV0(
      new xdr.ConfigSettingContractComputeV0({
        ledgerMaxInstructions: 100_000_000n,
        txMaxInstructions: 10_000_000n,
        feeRatePerInstructionsIncrement: 100n,
        txMemoryLimit: 40000,
      }),
    ),
    xdr.ConfigSettingEntry.configSettingContractLedgerCostV0(
      new xdr.ConfigSettingContractLedgerCostV0({
        ledgerMaxDiskReadEntries: 10,
        ledgerMaxDiskReadBytes: 10000,
        ledgerMaxWriteLedgerEntries: 10,
        ledgerMaxWriteBytes: 10000,
        txMaxDiskReadEntries: 5,
        txMaxDiskReadBytes: 5000,
        txMaxWriteLedgerEntries: 5,
        txMaxWriteBytes: 5000,
        feeDiskReadLedgerEntry: 100n,
        feeWriteLedgerEntry: 100n,
        feeDiskRead1Kb: 10n,
        sorobanStateTargetSizeBytes: 100n,
        rentFee1KbSorobanStateSizeLow: 1n,
        rentFee1KbSorobanStateSizeHigh: 2n,
        sorobanStateRentFeeGrowthFactor: 1,
      }),
    ),
    xdr.ConfigSettingEntry.configSettingContractLedgerCostExtV0(
      new xdr.ConfigSettingContractLedgerCostExtV0({
        txMaxFootprintEntries: 10,
        feeWrite1Kb: 1000n,
      }),
    ),
  ];
  return values.map((
    value,
  ) => ({
    val: xdr.LedgerEntryData.configSetting(value),
  } as Api.LedgerEntryResult));
}

function settingsRpc(
  entries = settingEntries(),
  protocolVersion = "27",
): ResourceSettingsRpc {
  return {
    getNetwork: () =>
      Promise.resolve({
        passphrase: network.networkPassphrase,
        protocolVersion,
      }),
    getLedgerEntries: (...keys) => {
      assertEquals(keys.length, 3);
      assertEquals(keys.map((key) => key.type), [
        "configSetting",
        "configSetting",
        "configSetting",
      ]);
      return Promise.resolve({ entries, latestLedger: 200 });
    },
  };
}

describe("network resource settings", () => {
  it("batches required settings, tolerates response ordering and preserves provenance", async () => {
    const result = await getNetworkResourceSettings({
      rpc: settingsRpc(settingEntries().reverse()),
    });
    assertEquals(result.latestLedger, 200);
    assertEquals(result.protocolVersion, 27);
    assertEquals(result.networkPassphrase, network.networkPassphrase);
    assertEquals(result.limits, {
      instructions: 10_000_000,
      diskReadBytes: 5000,
      writeBytes: 5000,
      memoryBytes: 40000,
      footprintEntries: 10,
    });
    assertEquals(result.fees, settings.fees);
  });

  it("rejects missing, duplicate, unsupported and malformed settings", async () => {
    await assertRejects(
      () => getNetworkResourceSettings({ rpc: settingsRpc([]) }),
      ERROR.SETTINGS_UNAVAILABLE,
    );
    const entries = settingEntries();
    await assertRejects(
      () =>
        getNetworkResourceSettings({
          rpc: settingsRpc([...entries, entries[0]]),
        }),
      ERROR.SETTINGS_UNAVAILABLE,
    );
    for (const protocol of ["22", "NaN"]) {
      await assertRejects(
        () =>
          getNetworkResourceSettings({ rpc: settingsRpc(entries, protocol) }),
        ERROR.SETTINGS_UNAVAILABLE,
      );
    }
    const invalid = {
      val: xdr.LedgerEntryData.configSetting(
        xdr.ConfigSettingEntry.configSettingContractComputeV0(
          new xdr.ConfigSettingContractComputeV0({
            ledgerMaxInstructions: 1n,
            txMaxInstructions: -1n,
            feeRatePerInstructionsIncrement: -1n,
            txMemoryLimit: 1,
          }),
        ),
      ),
    } as Api.LedgerEntryResult;
    await assertRejects(
      () =>
        getNetworkResourceSettings({
          rpc: settingsRpc([invalid, ...entries.slice(1)]),
        }),
      ERROR.SETTINGS_UNAVAILABLE,
    );
  });

  it("retains underlying RPC errors", async () => {
    const cause = new Error("offline");
    const error = await assertRejects(
      () =>
        getNetworkResourceSettings({
          rpc: {
            ...settingsRpc(),
            getNetwork: () => Promise.reject(cause),
          },
        }),
      ERROR.SETTINGS_UNAVAILABLE,
    );
    assertEquals(error.meta?.cause, cause);
  });
});
