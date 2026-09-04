import { assert, assertEquals, assertExists } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { StellarTestLedger } from "@colibri/test-tooling";
import { SEP41TokenContract } from "@/asset/sep41-token/index.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import { Contract } from "@/contract/index.ts";
import { Event } from "@/event/event.ts";
import { MintEvent } from "@/event/standards/sep41/mint.ts";
import { TransferEvent } from "@/event/standards/sep41/transfer.ts";
import { EventType } from "@/event/types.ts";
import { NativeAccount } from "@/account/native/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { ContractId, MuxedAddress } from "@/strkeys/types.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { SEP41_TOKEN_SPEC } from "colibri-internal/tests/specs/sep41-token.ts";
import { loadWasmFile } from "colibri-internal/util/load-wasm-file.ts";
import {
  encodeMuxedAccount,
  encodeMuxedAccountToAddress,
  nativeToScVal,
  rpc,
  type xdr,
} from "stellar-sdk";

describe("SEP41TokenContract integration", disableSanitizeConfig, () => {
  const ledger = new StellarTestLedger({
    containerName: `colibri-sep41-token-${crypto.randomUUID()}`,
    containerImageVersion: "testing",
    logLevel: "silent",
  });
  const owner = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const spender = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const recipient = NativeAccount.fromMasterSigner(
    LocalSigner.generateRandom(),
  );

  let token: SEP41TokenContract;
  let config: TransactionConfig;
  let rpcServer: rpc.Server;

  const eventsFrom = (
    contractEvents: xdr.ContractEvent[][],
    ledgerSequence: number,
    hash: string,
  ): Event[] =>
    contractEvents.flat().map((event, index) =>
      new Event({
        id: `${String(ledgerSequence).padStart(19, "0")}-${
          String(index).padStart(10, "0")
        }`,
        type: EventType.Contract,
        ledger: ledgerSequence,
        ledgerClosedAt: new Date(0).toISOString(),
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        txHash: hash,
        topic: event.body.v0.topics,
        value: event.body.v0.data,
      })
    );

  beforeAll(async () => {
    await ledger.start();
    const details = await ledger.getNetworkDetails();
    const networkConfig = NetworkConfig.CustomNet(details);
    rpcServer = new rpc.Server(details.rpcUrl, { allowHttp: true });

    for (const account of [owner, spender, recipient]) {
      await initializeWithFriendbot(details.friendbotUrl, account.address(), {
        rpcUrl: details.rpcUrl,
        allowHttp: true,
      });
    }

    config = {
      fee: "10000000",
      timeout: 30,
      source: owner.address(),
      signers: [owner.signer()],
    };
    const contract = new Contract({
      networkConfig,
      rpc: rpcServer,
      contractConfig: {
        wasm: await loadWasmFile(
          "./_internal/tests/compiled-contracts/sep41_token_contract.wasm",
        ),
        spec: SEP41_TOKEN_SPEC,
      },
    });
    await contract.uploadWasm(config);
    await contract.deploy({
      config,
      constructorArgs: { recipient: owner.address() },
    });
    token = new SEP41TokenContract({
      networkConfig,
      rpc: rpcServer,
      contractId: contract.getContractId() as ContractId,
    });
  });

  afterAll(async () => {
    await ledger.stop();
    await ledger.destroy();
  });

  it("reads metadata and executes the complete standardized interface", async () => {
    assertEquals(await token.decimals(), 7);
    assertEquals(await token.name(), "Colibri SEP-41 Test Token");
    assertEquals(await token.symbol(), "CLB41");
    assertEquals(await token.balance({ id: owner.address() }), 1_000_000_000n);

    const muxed = encodeMuxedAccountToAddress(
      encodeMuxedAccount(recipient.address(), "42"),
    ) as MuxedAddress;
    const transfer = await token.transfer({
      from: owner.address(),
      to: muxed,
      amount: 100n,
      config,
    });
    const transferEvent = eventsFrom(
      transfer.response.events.contractEventsXdr,
      transfer.ledger,
      transfer.hash,
    ).map((event) => TransferEvent.tryFromEvent(event)).find(Boolean);
    assertExists(transferEvent);
    assertEquals(transferEvent.amount, 100n);
    assertEquals(transferEvent.toMuxedId, 42n);

    const latest = await rpcServer.getLatestLedger();
    await token.approve({
      from: owner.address(),
      spender: spender.address(),
      amount: 50n,
      liveUntilLedger: latest.sequence + 100,
      config,
    });
    assertEquals(
      await token.allowance({
        from: owner.address(),
        spender: spender.address(),
      }),
      50n,
    );

    const delegatedConfig = {
      ...config,
      signers: [owner.signer(), spender.signer()],
    };
    await token.transferFrom({
      spender: spender.address(),
      from: owner.address(),
      to: recipient.address(),
      amount: 20n,
      config: delegatedConfig,
    });
    assertEquals(await token.balance({ id: recipient.address() }), 120n);
    assertEquals(
      await token.allowance({
        from: owner.address(),
        spender: spender.address(),
      }),
      30n,
    );

    await token.burn({ from: owner.address(), amount: 10n, config });
    await token.burnFrom({
      spender: spender.address(),
      from: owner.address(),
      amount: 5n,
      config: delegatedConfig,
    });
    assertEquals(
      await token.allowance({
        from: owner.address(),
        spender: spender.address(),
      }),
      25n,
    );
    assertEquals(await token.balance({ id: owner.address() }), 999_999_865n);
  });

  it("uses the underlying Contract for custom methods and parses extensions", async () => {
    const result = await token.contract.invokeRaw({
      operationArgs: {
        function: "mint_with_reference",
        args: [
          nativeToScVal(recipient.address(), { type: "address" }),
          nativeToScVal(25n, { type: "i128" }),
          nativeToScVal("invoice-42", { type: "string" }),
        ],
      },
      config,
    });
    const customMint = eventsFrom(
      result.response.events.contractEventsXdr,
      result.ledger,
      result.hash,
    ).map((event) => MintEvent.tryFromEvent(event)).find((event) =>
      event?.extensions.reference === "invoice-42"
    );

    assertExists(customMint);
    assertEquals(customMint.amount, 25n);
    assertEquals(
      customMint.decodeExtensions((extensions) => ({
        reference: String(extensions.reference),
      })),
      { reference: "invoice-42" },
    );
    assertEquals(await token.balance({ id: recipient.address() }), 145n);
    assert(result.hash.length > 0);
  });
});
