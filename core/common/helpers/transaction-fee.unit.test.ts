import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Keypair,
  Operation,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import {
  getTransactionInclusionFee,
  getTransactionResourceFee,
  parseTransactionFee,
  setTransactionFee,
} from "@/common/helpers/transaction-fee.ts";
import { NetworkConfig } from "@/network/index.ts";

const source = "GB3MXH633VRECLZRUAR3QCLQJDMXNYNHKZCO6FJEWXVWSUEIS7NU376P";

const makeTransaction = (resourceFee?: number) => {
  const builder = new TransactionBuilder(new Account(source, "100"), {
    fee: "200",
    networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
  }).addOperation(Operation.setOptions({})).setTimeout(0);

  if (resourceFee !== undefined) {
    builder.setSorobanData(
      new SorobanDataBuilder().setResourceFee(resourceFee).build(),
    );
  }

  return builder.build();
};

describe("transaction fee helpers", () => {
  describe("parseTransactionFee", () => {
    it("parses each supported fee mode", () => {
      assertEquals(parseTransactionFee({ base: "100" }), {
        ok: true,
        value: { mode: "base", amount: 100n },
      });
      assertEquals(parseTransactionFee({ inclusion: "201" }), {
        ok: true,
        value: { mode: "inclusion", amount: 201n },
      });
      assertEquals(parseTransactionFee({ max: "500" }), {
        ok: true,
        value: { mode: "max", amount: 500n },
      });
    });

    it("rejects values that do not select exactly one supported mode", () => {
      for (
        const fee of [
          undefined,
          "100",
          [],
          {},
          { unknown: "100" },
          { base: "100", max: "500" },
        ]
      ) {
        assertEquals(parseTransactionFee(fee), {
          ok: false,
          error: { reason: "invalid-configuration" },
        });
      }
    });

    it("identifies invalid amounts and their selected modes", () => {
      assertEquals(parseTransactionFee({ base: -1 }), {
        ok: false,
        error: { reason: "invalid-amount", mode: "base", value: -1 },
      });
      assertEquals(parseTransactionFee({ inclusion: "1.5" }), {
        ok: false,
        error: {
          reason: "invalid-amount",
          mode: "inclusion",
          value: "1.5",
        },
      });
      assertEquals(parseTransactionFee({ max: "-1" }), {
        ok: false,
        error: { reason: "invalid-amount", mode: "max", value: "-1" },
      });
    });
  });

  it("reads the inclusion and resource components from transaction XDR", () => {
    const classicTransaction = makeTransaction();
    assertEquals(getTransactionResourceFee(classicTransaction), 0n);
    assertEquals(getTransactionInclusionFee(classicTransaction), 200n);

    const sorobanTransaction = makeTransaction(30);
    assertEquals(getTransactionResourceFee(sorobanTransaction), 30n);
    assertEquals(getTransactionInclusionFee(sorobanTransaction), 200n);
  });

  it("sets the exact fee in transaction XDR without mutating the input", () => {
    const transaction = makeTransaction();
    transaction.signatures.push(
      new xdr.DecoratedSignature({
        hint: new Uint8Array([1, 2, 3, 4]),
        signature: new Uint8Array([5, 6, 7]),
      }),
    );
    const adjusted = setTransactionFee(transaction, 201n);
    const restored = setTransactionFee(adjusted, 200n);

    assertEquals(transaction.fee, "200");
    assertEquals(adjusted.fee, "201");
    assertEquals(adjusted.operations.length, transaction.operations.length);
    assertEquals(adjusted.operations[0].type, transaction.operations[0].type);
    assertEquals(adjusted.sequence, transaction.sequence);
    assertEquals(adjusted.signatures, transaction.signatures);
    assertEquals(restored.toXdr(), transaction.toXdr());
  });

  it("reconstructs a v0 envelope while preserving every field and signature", () => {
    const v1 = makeTransaction();
    if (!(v1.tx instanceof xdr.Transaction)) {
      throw new Error("Expected a v1 transaction fixture");
    }
    const signature = new xdr.DecoratedSignature({
      hint: new Uint8Array([1, 2, 3, 4]),
      signature: new Uint8Array([5, 6, 7]),
    });
    const v0 = new Transaction(
      xdr.TransactionEnvelope.envelopeTypeTxV0(
        new xdr.TransactionV0Envelope({
          tx: new xdr.TransactionV0({
            sourceAccountEd25519: Keypair.fromPublicKey(source).rawPublicKey(),
            fee: 200,
            seqNum: v1.tx.seqNum,
            timeBounds: null,
            memo: v1.tx.memo,
            operations: v1.tx.operations,
            ext: xdr.TransactionV0Ext.v0(),
          }),
          signatures: [signature],
        }),
      ),
      NetworkConfig.TestNet().networkPassphrase,
    );

    const adjusted = setTransactionFee(v0, 301n);
    const restored = setTransactionFee(adjusted, 200n);

    assertEquals(v0.fee, "200");
    assertEquals(adjusted.fee, "301");
    assertEquals(adjusted.signatures, [signature]);
    assertEquals(restored.toXdr(), v0.toXdr());
  });
});
