import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { pipe, plugin, step } from "convee";
import { Keypair, Operation, Transaction } from "stellar-sdk";
import { LocalSigner } from "@/signer/local/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import type { BuildTransactionInput } from "@/processes/build-transaction/types.ts";
import { NO_OPERATIONS_PROVIDED_ERROR } from "@/processes/build-transaction/error.ts";
import {
  BUILD_TRANSACTION_STEP_ID,
  createBuildTransactionStep,
  createEnvelopeSigningRequirementsStep,
  createSignEnvelopeStep,
} from "@/steps/index.ts";
import { buildToEnvelopeSigningRequirements } from "@/pipelines/shared/connectors/build-to-envelope-signing-req.ts";
import { createEnvSignReqToSignEnvelope } from "@/pipelines/shared/connectors/envelope-signing-req-to-sign-envelope.ts";

type OfflineSigningInput = {
  build: BuildTransactionInput & { sequence: string };
  config: { signers: LocalSigner[] };
};

const signingInput = (sequence: string): OfflineSigningInput => {
  const source = LocalSigner.generateRandom();
  const operationSource = LocalSigner.generateRandom();
  return {
    build: {
      source: source.publicKey(),
      sequence,
      networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
      baseFee: "205",
      operations: [
        Operation.setOptions({ homeDomain: "example.org" }),
        Operation.setOptions({ source: operationSource.publicKey() }),
      ],
    },
    config: { signers: [source, operationSource] },
  };
};

// Exercise the real Colibri steps and connector without an RPC or mocked process.
// The connector consumes spread signature requirements and reads prior outputs
// from Convee's run context, as it does in the built-in transaction pipelines.
const createOfflineSigningPipeline = () =>
  pipe([
    step((input: OfflineSigningInput) => input, {
      id: "signing-input" as const,
    }),
    step((input: OfflineSigningInput) => input.build, {
      id: "build-input" as const,
    }),
    createBuildTransactionStep(),
    step(buildToEnvelopeSigningRequirements, {
      id: "signing-requirements-input" as const,
    }),
    createEnvelopeSigningRequirementsStep(),
    createEnvSignReqToSignEnvelope<OfflineSigningInput, Transaction>({
      id: "signing-connector",
      inputStepId: "signing-input",
      transactionStepId: BUILD_TRANSACTION_STEP_ID,
    }),
    createSignEnvelopeStep(),
  ]);

describe("Convee compatibility", () => {
  it("keeps a step callable after use and remove without changing its transaction", async () => {
    const build = createBuildTransactionStep();
    const observed: Transaction[] = [];
    const observer = plugin({ id: "observe-build" }).onOutput(
      (transaction: Transaction) => {
        observed.push(transaction);
        return transaction;
      },
    );

    assertStrictEquals(build.use(observer), build);
    const input = signingInput("100").build;
    const transaction = await build(input);
    assertStrictEquals(observed[0], transaction);
    assertEquals(transaction.fee, "410");

    assertStrictEquals(build.remove(observer.id), build);
    assertEquals((await build(input)).toXdr(), transaction.toXdr());
    assertEquals(observed.length, 1);
  });

  it("preserves per-run context and all envelope requirements during concurrent signing", async () => {
    const sign = createOfflineSigningPipeline();
    const observed: Transaction[] = [];
    const observer = plugin({
      id: "observe-built-transactions",
      target: BUILD_TRANSACTION_STEP_ID,
    }).onOutput((transaction: Transaction) => {
      observed.push(transaction);
      return transaction;
    });

    assertStrictEquals(sign.use(observer), sign);
    const inputs = [signingInput("100"), signingInput("200")];
    const transactions = await Promise.all(inputs.map((input) => sign(input)));

    for (const [index, transaction] of transactions.entries()) {
      const input = inputs[index];
      assertInstanceOf(transaction, Transaction);
      assertEquals(transaction.source, input.build.source);
      assertEquals(
        transaction.sequence,
        String(BigInt(input.build.sequence) + 1n),
      );
      assertEquals(transaction.fee, "410");
      assertEquals(transaction.signatures.length, 2);
      for (const signer of input.config.signers) {
        assertEquals(
          transaction.signatures.some((signature) =>
            Keypair.fromPublicKey(signer.publicKey()).verify(
              transaction.hash(),
              signature.signature,
            )
          ),
          true,
        );
      }
    }

    assertEquals(observed.length, 2);
    assertStrictEquals(sign.remove(observer.id), sign);
    await sign(signingInput("300"));
    assertEquals(observed.length, 2);
  });

  it("preserves Colibri error identity through an error hook and remains reusable", async () => {
    const sign = createOfflineSigningPipeline();
    const errors: Error[] = [];
    const observer = plugin({ id: "observe-signing-error" }).onError(
      (error: Error) => {
        errors.push(error);
        return error;
      },
    );
    sign.use(observer);

    const input = signingInput("100");
    input.build.operations = [];
    const error = await assertRejects(
      () => sign(input),
      NO_OPERATIONS_PROVIDED_ERROR,
    );
    assertStrictEquals(errors[0], error);

    const transaction = await sign(signingInput("200"));
    assertEquals(transaction.signatures.length, 2);
    assertEquals(errors.length, 1);
  });
});
