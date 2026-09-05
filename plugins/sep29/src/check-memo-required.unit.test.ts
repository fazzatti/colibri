import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  Memo,
  MuxedAccount,
  Networks,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import type { xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { LocalSigner } from "@colibri/core";
import {
  checkMemoRequired,
  createSep29Plugin,
  Sep29Errors as E,
} from "@colibri/plugin-sep29";
import { memoDestinations } from "@/destinations.ts";
import {
  type CheckMemoRequiredInput,
  SEP29_PLUGIN_ID,
  SEP29_PLUGIN_TARGET,
} from "@/types.ts";

describe("SEP-29 transaction inspection", () => {
  const source = LocalSigner.generateRandom().publicKey();
  const recipients = Array.from(
    { length: 4 },
    () => LocalSigner.generateRandom().publicKey(),
  );
  const rpc = new Server("http://127.0.0.1:1", { allowHttp: true });
  const build = (operations: xdr.Operation[], memo: Memo = Memo.none()) => {
    const builder = new TransactionBuilder(new Account(source, "0"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
      memo,
    });
    for (const operation of operations) builder.addOperation(operation);
    return builder.setTimeout(60).build();
  };
  const payment = (destination = recipients[0]) =>
    Operation.payment({ destination, asset: Asset.native(), amount: "1" });

  it("extracts precisely the four standard operations and deduplicates by G destination", () => {
    const muxed = new MuxedAccount(new Account(recipients[0], "0"), "29")
      .accountId();
    const transaction = build([
      Operation.manageData({ name: "irrelevant", value: "1" }),
      payment(),
      Operation.pathPaymentStrictSend({
        destination: recipients[1],
        sendAsset: Asset.native(),
        sendAmount: "1",
        destAsset: Asset.native(),
        destMin: "1",
        path: [],
      }),
      Operation.pathPaymentStrictReceive({
        destination: recipients[2],
        sendAsset: Asset.native(),
        sendMax: "1",
        destAsset: Asset.native(),
        destAmount: "1",
        path: [],
      }),
      Operation.accountMerge({ destination: recipients[3] }),
      payment(),
      Operation.payment({
        destination: muxed,
        asset: Asset.native(),
        amount: "1",
      }),
      Operation.createAccount({ destination: source, startingBalance: "10" }),
    ]);
    assertEquals(
      memoDestinations(transaction),
      recipients.map((destination, index) => ({
        destination,
        operationIndex: index + 1,
      })),
    );
  });

  it("accepts any non-none memo without contacting RPC or modifying the envelope", async () => {
    for (
      const memo of [
        Memo.text(""),
        Memo.id("0"),
        Memo.text("not validated"),
        Memo.hash(new Uint8Array(32)),
        Memo.return(new Uint8Array(32)),
      ]
    ) {
      const transaction = build([payment()], memo);
      const before = transaction.toXdr();
      await checkMemoRequired({ transaction, rpc });
      assertEquals(transaction.toXdr(), before);
      const feeBump = TransactionBuilder.buildFeeBumpTransaction(
        source,
        "100",
        transaction,
        Networks.TESTNET,
      );
      const feeBefore = feeBump.toXdr();
      await checkMemoRequired({ transaction: feeBump, rpc });
      assertEquals(feeBump.toXdr(), feeBefore);
    }
  });

  it("does not contact RPC for irrelevant or muxed destinations", async () => {
    const muxed = new MuxedAccount(new Account(recipients[0], "0"), "1")
      .accountId();
    for (
      const operation of [
        Operation.manageData({ name: "a", value: null }),
        Operation.payment({
          destination: muxed,
          asset: Asset.native(),
          amount: "1",
        }),
        Operation.accountMerge({ destination: muxed }),
        Operation.pathPaymentStrictSend({
          destination: muxed,
          sendAsset: Asset.native(),
          sendAmount: "1",
          destAsset: Asset.native(),
          destMin: "1",
          path: [],
        }),
        Operation.pathPaymentStrictReceive({
          destination: muxed,
          sendAsset: Asset.native(),
          sendMax: "1",
          destAsset: Asset.native(),
          destAmount: "1",
          path: [],
        }),
      ]
    ) {
      await checkMemoRequired({ transaction: build([operation]), rpc });
    }
  });

  it("fails with distinct typed envelope and connection errors", async () => {
    await assertRejects(
      () => checkMemoRequired({ transaction: {} } as CheckMemoRequiredInput),
      E.INVALID_TRANSACTION,
    );
    await assertRejects(
      () =>
        checkMemoRequired(
          { transaction: build([payment()]) } as CheckMemoRequiredInput,
        ),
      E.FAILED_TO_CREATE_READER,
    );
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const port = listener.addr.port;
    listener.close();
    const error = await assertRejects(
      () =>
        checkMemoRequired({
          transaction: build([payment()]),
          rpc: new Server(`http://127.0.0.1:${port}`, { allowHttp: true }),
        }),
      E.FAILED_TO_READ_REQUIREMENTS,
    );
    assertEquals(error.code, E.Code.FAILED_TO_READ_REQUIREMENTS);
  });

  it("exposes stable plugin and error identifiers", () => {
    const guard = createSep29Plugin();
    assertEquals(guard.id, SEP29_PLUGIN_ID);
    assertEquals(guard.target, SEP29_PLUGIN_TARGET);
    const error = new E.MEMO_REQUIRED(recipients[0], 4);
    assertEquals(error.destination, recipients[0]);
    assertEquals(error.operationIndex, 4);
    assertEquals(error.code, E.Code.MEMO_REQUIRED);
    assertStrictEquals(E.ERROR_PLG_SEP29[error.code], E.MEMO_REQUIRED);
  });
});
