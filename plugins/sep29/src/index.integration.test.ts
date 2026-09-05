import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  FeeBumpTransaction,
  Memo,
  MuxedAccount,
  Operation,
  Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import type { xdr } from "stellar-sdk";
import { Api, Server } from "stellar-sdk/rpc";
import { plugin } from "convee";
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  steps,
} from "@colibri/core";
import type { SendTransactionInput, TransactionConfig } from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { StellarTestLedger } from "@colibri/test-tooling";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { checkMemoRequired } from "@/check-memo-required.ts";
import { createSep29Plugin } from "@/index.ts";
import { SEP29_MEMO_REQUIRED_DATA_NAME } from "@/types.ts";
import * as E from "@/error.ts";

describe("SEP-29 on Quickstart", disableSanitizeConfig, () => {
  const ledger = new StellarTestLedger({
    containerName: `colibri-sep29-${crypto.randomUUID()}`,
    containerImageVersion: "testing",
    logLevel: "silent",
  });
  const sender = LocalSigner.generateRandom();
  const recipients = Array.from(
    { length: 5 },
    () => LocalSigner.generateRandom(),
  );
  const required = recipients[0].publicKey();
  let networkConfig: NetworkConfig;
  let rpc: Server;
  let config: TransactionConfig;
  const payment = (destination = required) =>
    Operation.payment({ destination, asset: Asset.native(), amount: "1" });
  const build = (operations: xdr.Operation[], memo: Memo = Memo.none()) => {
    const builder = new TransactionBuilder(
      new Account(sender.publicKey(), "0"),
      { fee: "100", networkPassphrase: networkConfig.networkPassphrase, memo },
    );
    for (const operation of operations) builder.addOperation(operation);
    return builder.setTimeout(60).build();
  };
  const execute = () =>
    createClassicTransactionPipeline({ networkConfig, rpc });

  beforeAll(async () => {
    await ledger.start();
    networkConfig = NetworkConfig.CustomNet(
      await ledger.getNetworkConfiguration(),
    );
    rpc = new Server(networkConfig.rpcUrl!, { allowHttp: true });
    await initializeWithFriendbot(
      networkConfig.friendbotUrl!,
      sender.publicKey(),
      { rpcUrl: networkConfig.rpcUrl!, allowHttp: true },
    );
    config = {
      source: sender.publicKey(),
      signers: [sender],
      fee: "100",
      timeout: 60,
    };
    await execute()({
      operations: recipients.map((recipient) =>
        Operation.createAccount({
          destination: recipient.publicKey(),
          startingBalance: "10",
        })
      ),
      config,
    });
    await execute()({
      operations: ["1", "0", "11", ""].map((value, index) =>
        Operation.manageData({
          source: recipients[index].publicKey(),
          name: SEP29_MEMO_REQUIRED_DATA_NAME,
          value,
        })
      ),
      config: { ...config, signers: [sender, ...recipients] },
    });
  });
  afterAll(async () => {
    await ledger.stop();
    await ledger.destroy();
  });

  it("rejects all four standard operation types without modifying native envelopes", async () => {
    const operations = [
      payment(),
      Operation.pathPaymentStrictSend({
        destination: required,
        sendAsset: Asset.native(),
        sendAmount: "1",
        destAsset: Asset.native(),
        destMin: "1",
        path: [],
      }),
      Operation.pathPaymentStrictReceive({
        destination: required,
        sendAsset: Asset.native(),
        sendMax: "1",
        destAsset: Asset.native(),
        destAmount: "1",
        path: [],
      }),
      Operation.accountMerge({ destination: required }),
    ];
    for (const operation of operations) {
      const transaction = build([operation]);
      const before = transaction.toXdr();
      const error = await assertRejects(
        () => checkMemoRequired({ transaction, rpc }),
        E.MEMO_REQUIRED,
      );
      assertEquals(error.destination, required);
      assertEquals(error.operationIndex, 0);
      assertEquals(transaction.toXdr(), before);
    }
  });

  it("uses exact ASCII 1, treats missing accounts/data as unset, and checks later operations", async () => {
    const destinations = [
      ...recipients.slice(1).map((r) => r.publicKey()),
      LocalSigner.generateRandom().publicKey(),
    ];
    await checkMemoRequired({
      transaction: build(destinations.map(payment)),
      networkConfig,
    });
    const transaction = build([
      ...destinations.map(payment),
      payment(),
      payment(),
    ]);
    const error = await assertRejects(
      () => checkMemoRequired({ transaction, networkConfig }),
      E.MEMO_REQUIRED,
    );
    assertEquals(error.operationIndex, destinations.length);
    assertEquals(error.destination, required);
  });

  it("checks all 100 native operation slots without repeated destination reads being needed", async () => {
    const transaction = build([
      ...Array.from({ length: 99 }, () => payment(recipients[4].publicKey())),
      payment(),
    ]);
    const error = await assertRejects(
      () => checkMemoRequired({ transaction, rpc }),
      E.MEMO_REQUIRED,
    );
    assertEquals(error.operationIndex, 99);
  });

  it("skips a muxed destination even when its base account requires a memo", async () => {
    const destination = new MuxedAccount(new Account(required, "0"), "29")
      .accountId();
    const send = execute();
    send.use(createSep29Plugin());
    const result = await send({
      operations: [
        Operation.payment({ destination, asset: Asset.native(), amount: "1" }),
      ],
      config,
    });
    assertEquals(result.response.status, Api.GetTransactionStatus.SUCCESS);
    const tx = TransactionBuilder.fromXdr(
      result.response.envelopeXdr,
      networkConfig.networkPassphrase,
    );
    assertInstanceOf(tx, Transaction);
    assertEquals(tx.operations[0].type, "payment");
    assertEquals(tx.memo.type, "none");
  });

  it("is opt-in and prevents submission without consuming the source sequence", async () => {
    // SEP-29 is a client convention, not a Stellar transaction-validity rule.
    await execute()({ operations: [payment()], config });
    const before = (await rpc.getAccount(sender.publicKey())).sequenceNumber();
    const send = execute();
    send.use(createSep29Plugin());
    await assertRejects(
      () => send({ operations: [payment()], config }),
      E.MEMO_REQUIRED,
    );
    assertEquals(
      (await rpc.getAccount(sender.publicKey())).sequenceNumber(),
      before,
    );
  });

  it("forwards and confirms every native memo kind, including zero and empty text", async () => {
    const send = execute();
    send.use(createSep29Plugin());
    for (
      const memo of [
        Memo.id("0"),
        Memo.text(""),
        Memo.text("recipient reference"),
        Memo.hash(new Uint8Array(32).fill(3)),
        Memo.return(new Uint8Array(32).fill(4)),
      ]
    ) {
      const result = await send({
        operations: [payment()],
        config: { ...config, memo },
      });
      const tx = TransactionBuilder.fromXdr(
        result.response.envelopeXdr,
        networkConfig.networkPassphrase,
      );
      assertInstanceOf(tx, Transaction);
      assertEquals(
        tx.memo.toXdrObject().toXdr("base64"),
        memo.toXdrObject().toXdr("base64"),
      );
      assertEquals(result.response.status, Api.GetTransactionStatus.SUCCESS);
    }
  });

  it("works before or after fee-bump wrapping and checks the inner memo", async () => {
    for (const checkFirst of [true, false]) {
      const guard = createSep29Plugin();
      const feeBump = createFeeBumpPlugin({
        networkConfig,
        feeBumpConfig: {
          source: sender.publicKey(),
          signers: [sender],
          fee: "100",
        },
      });
      const send = execute();
      if (checkFirst) send.use(guard).use(feeBump);
      else send.use(feeBump).use(guard);
      await assertRejects(
        () => send({ operations: [payment()], config }),
        E.MEMO_REQUIRED,
      );
      const memo = Memo.id("29");
      const result = await send({
        operations: [payment()],
        config: { ...config, memo },
      });
      const tx = TransactionBuilder.fromXdr(
        result.response.envelopeXdr,
        networkConfig.networkPassphrase,
      );
      assertInstanceOf(tx, FeeBumpTransaction);
      assertEquals(tx.innerTransaction.memo.value, "29");
    }
  });

  it("returns the exact submission input object and signed XDR unchanged", async () => {
    const transaction = new TransactionBuilder(
      await rpc.getAccount(sender.publicKey()),
      { fee: "100", networkPassphrase: networkConfig.networkPassphrase },
    ).addOperation(payment(recipients[4].publicKey())).setTimeout(60).build();
    const signed = TransactionBuilder.fromXdr(
      await sender.signTransaction(transaction),
      networkConfig.networkPassphrase,
    );
    const before = signed.toXdr();
    const input: SendTransactionInput = { transaction: signed, rpc };
    const capture = plugin({
      id: "sep29-input-observation",
      target: "send-transaction",
    }).onInput((observed: SendTransactionInput) => {
      assertStrictEquals(observed, input);
      assertEquals(observed.transaction.toXdr(), before);
      return observed;
    });
    const submit = steps.createSendTransactionStep();
    submit.use(createSep29Plugin());
    submit.use(capture);
    await submit(input);
    assertEquals(signed.toXdr(), before);
  });
});
