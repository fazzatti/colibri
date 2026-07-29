import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Address,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import { Buffer } from "buffer";
import { signEnvelope } from "@/processes/sign-envelope/index.ts";
import { SIGNER_NOT_FOUND } from "@/processes/sign-envelope/error.ts";
import { DelegatedSigner } from "@/signer/delegated/index.ts";
import { OperationThreshold } from "@/signer/types.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";

describe("signEnvelope delegated signer compatibility", () => {
  it("ignores auth-entry-only signers and identifies them in diagnostics", async () => {
    const source = Keypair.random().publicKey() as Ed25519PublicKey;
    const requiredSigner = Keypair.random().publicKey() as Ed25519PublicKey;
    const delegatedAddress = Address.contract(Buffer.alloc(32, 42))
      .toString() as ContractId;
    const transaction = new TransactionBuilder(
      new Account(source, "1"),
      { fee: "100", networkPassphrase: Networks.TESTNET },
    )
      .addOperation(Operation.setOptions({}))
      .setTimeout(0)
      .build();

    const error = await assertRejects(
      () =>
        signEnvelope({
          transaction,
          signatureRequirements: [{
            address: requiredSigner,
            thresholdLevel: OperationThreshold.low,
          }],
          signers: [new DelegatedSigner({ address: delegatedAddress })],
        }),
      SIGNER_NOT_FOUND,
    );

    assertEquals(
      error.details?.includes("Available signers: [DelegatedSigner]"),
      true,
    );
  });
});
