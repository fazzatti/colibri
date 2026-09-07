// This 1.0 consumer is a compatibility contract. Add new fixtures for new APIs;
// do not rewrite this one to make a later breaking candidate pass.
import { Keypair, Networks, Operation, Transaction } from "stellar-sdk";
import { pipe, plugin, step } from "convee";
import {
  BTX_ERRORS,
  type BuildTransactionInput,
  ColibriError,
  Contract,
  type EnvelopeSigner,
  type ExtraSignerKey,
  type SignableTransaction,
  type SignEnvelopeInput,
  steps,
} from "@colibri/core";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

class ApplicationSigner implements EnvelopeSigner {
  constructor(readonly key: Keypair) {}
  signerKey(): ExtraSignerKey {
    return this.key.publicKey() as ExtraSignerKey;
  }
  signsFor(address: string): boolean {
    return address === this.key.publicKey();
  }
  signTransaction(transaction: SignableTransaction): string {
    transaction.sign(this.key);
    return transaction.toXdr();
  }
}

class ApplicationContract extends Contract {
  describeBinding(): string | undefined {
    return this.contractId;
  }
}
check(
  typeof ApplicationContract.prototype.describeBinding === "function",
  "Public Contract extension remains valid",
);

const signer = new ApplicationSigner(Keypair.random());
const buildInput: BuildTransactionInput = {
  source: signer.signerKey() as `G${string}`,
  sequence: "123",
  networkPassphrase: Networks.TESTNET,
  transactionFee: { inclusion: "205" },
  operations: [Operation.setOptions({ homeDomain: "consumer.example" })],
  preconditions: { timeoutSeconds: 0 },
};
const lifecycle: string[] = [];
const build = steps.createBuildTransactionStep();
const sign = steps.createSignEnvelopeStep();
const signTransaction = pipe([
  build,
  step((transaction: Transaction): SignEnvelopeInput => ({
    transaction,
    signers: [signer],
    signatureRequirements: [{
      address: buildInput.source as `G${string}`,
      thresholdLevel: 2,
    }],
  })),
  sign,
]);
const observer = plugin({
  id: "application-observer",
  target: steps.BUILD_TRANSACTION_STEP_ID,
})
  .onOutput((transaction: Transaction) => {
    lifecycle.push("built");
    return transaction;
  });
signTransaction.use(observer);
const transaction = await signTransaction(buildInput);
check(transaction instanceof Transaction, "Native transaction identity");
check(
  transaction.fee === "205" && transaction.sequence === "124",
  "1.0 fee and sequence semantics",
);
check(
  signer.key.verify(transaction.hash(), transaction.signatures[0].signature),
  "Application signer produced a real verifiable signature",
);
check(
  lifecycle.join() === "built",
  "Targeted plugin observed the real build step",
);
signTransaction.remove(observer.id);
await signTransaction(buildInput);
check(
  lifecycle.length === 1,
  "Removing a plugin preserves callable pipeline reuse",
);

let rejected = false;
try {
  await signTransaction({ ...buildInput, operations: [] });
} catch (error) {
  check(error instanceof ColibriError, "Public base error identity");
  check(
    error instanceof BTX_ERRORS.NO_OPERATIONS_PROVIDED_ERROR,
    "Specific error identity",
  );
  check(error.code === "BTX_010", "Stable programmatic error code");
  rejected = true;
}
check(rejected, "Invalid input is rejected instead of submitting anything");
console.log(
  "1.0 extension consumer passed: custom signer, class extension, callable steps/pipeline, targeted plugin, native transaction, typed errors.",
);
