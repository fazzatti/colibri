import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Address,
  Keypair,
  Memo,
  MuxedAccount,
  nativeToScVal,
  Networks,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { assembleTransaction } from "@/processes/assemble-transaction/index.ts";
import { setTransactionFee } from "@/common/helpers/transaction-fee.ts";

describe("native transaction preservation matrix", () => {
  it("changes only auth and resources when assembling, and only the fee when repricing", async () => {
    const source = Keypair.random();
    const operationSource = Keypair.random().publicKey();
    const contract = Address.contract(new Uint8Array(32).fill(1));
    const invocation = (subInvocations: xdr.SorobanAuthorizedInvocation[]) =>
      new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: contract.toScAddress(),
              functionName: "transfer",
              args: [nativeToScVal(123n)],
            }),
          ),
        subInvocations,
      });
    const auth = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: invocation([invocation([invocation([])])]),
    });
    for (
      const memo of [
        Memo.none(),
        Memo.text("preserve"),
        Memo.id("18446744073709551615"),
        Memo.hash(new Uint8Array(32).fill(2)),
      ]
    ) {
      // Memo/bounds here exercise a pure transformation, not submit validity.
      // Current Stellar Core restricts non-empty Soroban memos.
      const sourceId = source.publicKey();
      const before = new TransactionBuilder(
        new Account(sourceId, "9007199254740993"),
        {
          fee: "203",
          networkPassphrase: Networks.TESTNET,
          memo,
          timebounds: { minTime: 1, maxTime: 123456 },
          ledgerbounds: { minLedger: 7, maxLedger: 1000 },
          minAccountSequence: "9007199254740900",
          minAccountSequenceAge: 5n,
          minAccountSequenceLedgerGap: 2,
          extraSigners: [source.publicKey()],
        },
      ).addOperation(
        Operation.invokeContractFunction({
          contract: contract.toString(),
          function: "transfer",
          args: [],
          source: operationSource,
        }),
      ).build();
      const original = before.toXDR();
      const after = await assembleTransaction({
        transaction: before,
        authEntries: [auth],
        sorobanData: new SorobanDataBuilder().setResourceFee(997),
      });
      assertEquals(before.toXDR(), original);
      const initial = before.tx;
      const result = after.tx;
      assert(
        initial instanceof xdr.Transaction &&
          result instanceof xdr.Transaction,
      );
      assertEquals(
        result.sourceAccount.toXdr(),
        initial.sourceAccount.toXdr(),
      );
      assertEquals(result.seqNum, initial.seqNum);
      assertEquals(result.cond.toXdr(), initial.cond.toXdr());
      assertEquals(result.memo.toXdr(), initial.memo.toXdr());
      assertEquals(
        result.operations[0].sourceAccount?.toXdr(),
        initial.operations[0].sourceAccount?.toXdr(),
      );
      const body = result.operations[0].body;
      if (body.type !== "invokeHostFunction") {
        throw new Error("Expected native invocation");
      }
      assertEquals(body.invokeHostFunctionOp.auth[0].toXdr(), auth.toXdr());
      assertEquals(after.fee, "1200");
      const repriced = setTransactionFee(after, 1300n);
      assertEquals(setTransactionFee(repriced, 1200n).toXDR(), after.toXDR());
      assertEquals(after.fee, "1200");
    }
  });
  it("reprices a native muxed classic source without changing its identity", () => {
    const source = new MuxedAccount(
      new Account(Keypair.random().publicKey(), "9007199254740993"),
      "99",
    );
    const transaction = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.setOptions({})).setTimeout(60).build();
    const repriced = setTransactionFee(transaction, 205n);
    assertEquals(repriced.source, transaction.source);
    assertEquals(repriced.sequence, transaction.sequence);
    assertEquals(
      setTransactionFee(repriced, 100n).toXDR(),
      transaction.toXDR(),
    );
  });
});
