import { ProcessEngine } from "convee";
import { TransactionBuilder } from "stellar-sdk";
import type {
  SignEnvelopeInput,
  SignEnvelopeOutput,
} from "@/processes/sign-envelope/types.ts";
import * as E from "@/processes/sign-envelope/error.ts";
import { assert } from "@/common/assert/assert.ts";

const signEnvelopeProcess = async (
  input: SignEnvelopeInput
): Promise<SignEnvelopeOutput> => {
  try {
    const { transaction, signatureRequirements, signers } = input;

    assert(signatureRequirements.length > 0, new E.NO_REQUIREMENTS(input));
    assert(signers.length > 0, new E.NO_SIGNERS(input));

    const passphrase = transaction.networkPassphrase;
    let signedTransaction = transaction;

    for (const requirement of signatureRequirements) {
      const requiredSigner = requirement.address;
      const signer = signers.find((s) => s.signsFor(requiredSigner));
      assert(signer, new E.SIGNER_NOT_FOUND(input, requiredSigner, signers));

      try {
        signedTransaction = TransactionBuilder.fromXDR(
          await signer.signTransaction(signedTransaction),
          passphrase
        ) as typeof transaction;
      } catch (error) {
        throw new E.FAILED_TO_SIGN_TRANSACTION(
          input,
          requiredSigner,
          error as Error
        );
      }
    }

    return signedTransaction;
  } catch (e) {
    if (e instanceof E.SignEnvelopeError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const PROCESS_NAME = "SignEnvelope" as const;

const P_SignEnvelope = () =>
  ProcessEngine.create<
    SignEnvelopeInput,
    SignEnvelopeOutput,
    E.SignEnvelopeError,
    typeof PROCESS_NAME
  >(signEnvelopeProcess, { name: PROCESS_NAME });

const P_SignEnvelopeErrors = E;

export { P_SignEnvelope, P_SignEnvelopeErrors };
