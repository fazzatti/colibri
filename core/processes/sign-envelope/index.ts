import { SignerKey as StellarSignerKey, TransactionBuilder } from "stellar-sdk";
import type {
  SignEnvelopeInput,
  SignEnvelopeOutput,
} from "@/processes/sign-envelope/types.ts";
import * as E from "@/processes/sign-envelope/error.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  isEnvelopeSigner,
  isPreAuthTransactionSigner,
} from "@/common/type-guards/is-signer.ts";
import { isTransaction } from "@/common/type-guards/is-transaction.ts";
import type {
  EnvelopeSigner,
  PreAuthTransactionSigner,
} from "@/signer/types.ts";
import type { ExtraSignerKey, PreAuthTx, SignerKey } from "@/strkeys/types.ts";

type EnvelopeAuthorizer = EnvelopeSigner | PreAuthTransactionSigner;
type IdentifiedAuthorizer = {
  index: number;
  key: SignerKey;
  signer: EnvelopeAuthorizer;
};

/** Signs a transaction envelope according to precomputed signature requirements. */
export const signEnvelope = async (
  input: SignEnvelopeInput,
): Promise<SignEnvelopeOutput> => {
  try {
    const { transaction, signatureRequirements, signers } = input;

    assert(signatureRequirements.length > 0, new E.NO_REQUIREMENTS(input));
    assert(signers.length > 0, new E.NO_SIGNERS(input));

    const passphrase = transaction.networkPassphrase;
    let signedTransaction = transaction;
    const authorizers = signers.filter((signer): signer is EnvelopeAuthorizer =>
      isEnvelopeSigner(signer) || isPreAuthTransactionSigner(signer)
    );
    const identities = new Map<EnvelopeAuthorizer, IdentifiedAuthorizer>();
    const identify = (
      signer: EnvelopeAuthorizer,
    ): IdentifiedAuthorizer => {
      const known = identities.get(signer);
      if (known) return known;

      const index = signers.indexOf(signer);
      let key: SignerKey;
      try {
        key = signer.signerKey();
      } catch (cause) {
        throw new E.FAILED_TO_GET_SIGNER_KEY(
          input,
          index,
          cause as Error,
        );
      }

      const identified = { index, key, signer };
      identities.set(signer, identified);
      return identified;
    };
    const selected = new Map<SignerKey, IdentifiedAuthorizer>();

    for (const requirement of signatureRequirements) {
      const requiredSigner = requirement.address;
      const matching = authorizers.filter((candidate) => {
        const { key } = identify(candidate);
        try {
          return candidate.signsFor(requiredSigner);
        } catch (cause) {
          throw new E.FAILED_TO_CHECK_SIGNER_TARGET(
            input,
            requiredSigner,
            key,
            cause as Error,
          );
        }
      }).map(identify);

      assert(
        matching.length > 0,
        new E.SIGNER_NOT_FOUND(input, requiredSigner, signers),
      );

      const matchingByKey = groupBySignerKey(matching);
      for (const [key, matches] of matchingByKey) {
        assert(
          matches.length === 1,
          new E.DUPLICATE_SIGNER_KEY(input, key),
        );
      }
      assert(
        matchingByKey.size === 1,
        new E.AMBIGUOUS_ACCOUNT_SIGNERS(
          input,
          requiredSigner,
          [...matchingByKey.keys()],
        ),
      );

      const signer = matching[0];
      selected.set(signer.key, signer);
    }

    for (const extraSignerKey of getExtraSignerKeys(input)) {
      const matching = authorizers
        .map(identify)
        .filter(({ key }) => key === extraSignerKey);

      assert(
        matching.length > 0,
        new E.EXTRA_SIGNER_NOT_FOUND(input, extraSignerKey),
      );
      assert(
        matching.length === 1,
        new E.DUPLICATE_SIGNER_KEY(input, extraSignerKey),
      );
      selected.set(extraSignerKey, matching[0]);
    }

    for (const { key, signer } of selected.values()) {
      if (isPreAuthTransactionSigner(signer)) {
        let authorized: boolean;
        try {
          authorized = await signer.authorizesTransaction(signedTransaction);
        } catch (cause) {
          throw new E.FAILED_TO_CHECK_PRE_AUTH_TRANSACTION(
            input,
            key as PreAuthTx,
            cause as Error,
          );
        }
        assert(
          authorized,
          new E.PRE_AUTH_TRANSACTION_MISMATCH(input, key as PreAuthTx),
        );
        continue;
      }

      let signedTransactionXdr: string;
      try {
        signedTransactionXdr = await signer.signTransaction(signedTransaction);
      } catch (cause) {
        throw new E.FAILED_TO_SIGN_TRANSACTION(input, key, cause as Error);
      }

      try {
        signedTransaction = TransactionBuilder.fromXdr(
          signedTransactionXdr,
          passphrase,
        ) as typeof transaction;
      } catch (cause) {
        throw new E.FAILED_TO_PARSE_SIGNED_TRANSACTION(
          input,
          key,
          cause as Error,
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

const groupBySignerKey = (
  signers: IdentifiedAuthorizer[],
): Map<SignerKey, IdentifiedAuthorizer[]> => {
  const grouped = new Map<SignerKey, IdentifiedAuthorizer[]>();
  for (const signer of signers) {
    const matches = grouped.get(signer.key) ?? [];
    matches.push(signer);
    grouped.set(signer.key, matches);
  }
  return grouped;
};

const getExtraSignerKeys = (
  input: SignEnvelopeInput,
): ExtraSignerKey[] => {
  if (!isTransaction(input.transaction)) return [];

  let signerKeys: SignerKey[];
  try {
    signerKeys = (input.transaction.extraSigners ?? []).map((signerKey) =>
      StellarSignerKey.encodeSignerKey(signerKey) as SignerKey
    );
  } catch (cause) {
    throw new E.FAILED_TO_READ_EXTRA_SIGNERS(input, cause as Error);
  }

  for (const signerKey of signerKeys) {
    assert(
      !signerKey.startsWith("T"),
      new E.UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER(
        input,
        signerKey as PreAuthTx,
      ),
    );
  }

  return signerKeys as ExtraSignerKey[];
};
/** Error constructors emitted by {@link signEnvelope}. */
export const SignEnvelopeErrors: typeof E = E;
