import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Buffer } from "buffer";
import { Asset, Operation } from "stellar-sdk";
import { StellarTestLedger } from "../../test-tooling/mod.ts";
import {
  LedgerEntries,
  buildAccountLedgerKey,
  buildConfigSettingLedgerKey,
  buildContractInstanceLedgerKey,
  buildDataLedgerKey,
  buildTtlLedgerKey,
} from "@/ledger-entries/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import { createClassicTransactionPipeline } from "@/pipelines/classic-transaction/index.ts";
import { Contract } from "@/contract/index.ts";
import * as E from "@/ledger-entries/error.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { ContractId } from "@/strkeys/types.ts";

describe("LedgerEntries integration", disableSanitizeConfig, () => {
  const testLedger = new StellarTestLedger({
    containerName: `colibri-ledger-entries-${crypto.randomUUID()}`,
    containerImageVersion: "testing",
    logLevel: "silent",
  });
  const wait = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

  const admin = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const user = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const issuer = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const asset = new Asset("LEDGER", issuer.address());
  const dataName = "profile";
  const dataValue = "colibri";

  let networkConfig: NetworkConfig;
  let classicPipe: ReturnType<typeof createClassicTransactionPipeline>;
  let ledger: LedgerEntries;

  let adminConfig: TransactionConfig;

  let contractId: ContractId;

  const unwrapCause = (error: unknown): string => {
    if (!(error instanceof Error)) {
      return String(error);
    }

    const meta = (
      error as Error & {
        meta?: {
          cause?: unknown;
          data?: {
            simulationResponse?: {
              error?: string;
            };
          };
        };
      }
    ).meta;
    const simulationError = meta?.data?.simulationResponse?.error;

    if (simulationError) {
      return `${error.message} ${simulationError}`;
    }

    const cause = meta?.cause;

    if (cause instanceof Error) {
      return unwrapCause(cause);
    }

    return error.message;
  };

  beforeAll(async () => {
    await testLedger.start();

    networkConfig = NetworkConfig.CustomNet(
      await testLedger.getNetworkConfiguration(),
    );
    classicPipe = createClassicTransactionPipeline({ networkConfig });
    ledger = new LedgerEntries({ networkConfig });
    adminConfig = {
      fee: "10000000",
      timeout: 120,
      source: admin.address(),
      signers: [admin.signer()],
    };

    for (const account of [admin, user, issuer]) {
      await initializeWithFriendbot(
        networkConfig.friendbotUrl!,
        account.address(),
        {
          rpcUrl: networkConfig.rpcUrl!,
          allowHttp: networkConfig.allowHttp,
        },
      );
    }

    await classicPipe.run({
      operations: [
        Operation.changeTrust({
          source: user.address(),
          asset,
        }),
      ],
      config: {
        fee: "10000000",
        timeout: 120,
        source: user.address(),
        signers: [user.signer()],
      },
    });

    await classicPipe.run({
      operations: [
        Operation.manageData({
          source: user.address(),
          name: dataName,
          value: dataValue,
        }),
      ],
      config: {
        fee: "10000000",
        timeout: 120,
        source: user.address(),
        signers: [user.signer()],
      },
    });

    const wasm = await loadWasmFile(
      "./_internal/tests/compiled-contracts/types_harness.wasm",
    );

    const contract = new Contract({
      networkConfig,
      contractConfig: {
        wasm: wasm as Buffer,
      },
    });

    try {
      await contract.uploadWasm(adminConfig);
      await contract.deploy({ config: adminConfig });
    } catch (error) {
      throw new Error(
        `Failed to prepare contract fixtures for LedgerEntries integration: ${unwrapCause(error)}`,
      );
    }

    contractId = contract.getContractId() as ContractId;

    await wait(1500);
  });

  afterAll(async () => {
    await testLedger.stop();
    await testLedger.destroy();
  });

  it("reads classic entries through convenience methods", async () => {
    const accountEntry = await ledger.account({ accountId: user.address() });
    const trustlineEntry = await ledger.trustline({
      accountId: user.address(),
      asset,
    });
    const dataEntry = await ledger.data({
      accountId: user.address(),
      dataName,
    });

    assertEquals(accountEntry.type, "account");
    assertEquals(accountEntry.accountId, user.address());
    assertEquals(trustlineEntry.type, "trustline");
    assertEquals(trustlineEntry.accountId, user.address());
    assertEquals(dataEntry.type, "data");
    assertEquals(new TextDecoder().decode(dataEntry.dataValue), dataValue);
  });

  it("reads network config settings", async () => {
    const configSetting = await ledger.configSetting({
      configSettingId: "configSettingContractMaxSizeBytes",
    });

    assertEquals(configSetting.type, "configSetting");
    assert(typeof configSetting.value === "number");
    assert((configSetting.value as number) > 0);
  });

  it("reads contract instance and code entries", async () => {
    const instance = await ledger.contractInstance({ contractId });
    const code = await ledger.contractCode({ contractId });

    assertEquals(instance.type, "contractInstance");
    assertEquals(instance.contractId, contractId);
    assertEquals(code.type, "contractCode");
    assert(code.hash.length > 0);
  });

  it("surfaces the rpc ttl-query limitation explicitly on generic reads", async () => {
    await assertRejects(
      () =>
        ledger.get(
          buildTtlLedgerKey({
            key: buildContractInstanceLedgerKey({ contractId }),
          }),
        ),
      E.UNSUPPORTED_RPC_LEDGER_KEY,
    );
  });

  it("supports typed batch reads across entry kinds", async () => {
    const [accountEntry, dataEntry, contractEntry, configEntry] =
      await ledger.getMany([
        buildAccountLedgerKey({ accountId: user.address() }),
        buildDataLedgerKey({ accountId: user.address(), dataName }),
        buildContractInstanceLedgerKey({ contractId }),
        buildConfigSettingLedgerKey({
          configSettingId: "configSettingContractMaxSizeBytes",
        }),
      ] as const);

    assertEquals(accountEntry?.type, "account");
    assertEquals(dataEntry?.type, "data");
    assertEquals(contractEntry?.type, "contractInstance");
    assertEquals(configEntry?.type, "configSetting");
  });
});
