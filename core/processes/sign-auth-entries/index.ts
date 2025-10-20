import { ProcessEngine } from "convee";
import type {
  SignAuthEntriesInput,
  SignAuthEntriesOutput,
  LedgerValidity,
} from "./types.ts";
import * as E from "./error.ts";

import { assert } from "../../common/assert/assert.ts";
import { xdr } from "stellar-sdk";
import { assertRequiredArgs } from "../../common/assert/assert-args.ts";
import type { Api, Server } from "stellar-sdk/rpc";
import {
  getAddressSignerFromAuthEntry,
  getAddressTypeFromAuthEntry,
} from "../../common/helpers/xdr/general.ts";

import { ResultOrError } from "../../common/deferred/result-or-error.ts";
import type { TransactionSigner } from "../../signer/types.ts";

const signAuthEntriesProcess = async (
  input: SignAuthEntriesInput
): Promise<SignAuthEntriesOutput> => {
  try {
    const { auth, rpc, signers, networkPassphrase, validity, removeUnsigned } =
      input;

    assertRequiredArgs(
      { auth, rpc, signers, networkPassphrase },
      (argName: string) => new E.MISSING_ARG(input, argName)
    );

    const validUntilLedgerSeq = (
      await getValidUntilLedgerSeq(validity, rpc)
    ).unwrap(input);

    const sourceAccountEntries = !removeUnsigned
      ? getSourceCredentialAuth(auth)
      : [];

    const { signed: originalSigned, unsigned: originalUnsigned } =
      separateSignedAndUnsignedAuthEntries(auth);

    const signedEntries = [...originalSigned];

    const entriesToSign = getAddressCredentialAuth(originalUnsigned);

    for (const authEntry of entriesToSign) {
      const addressType = getAddressTypeFromAuthEntry(authEntry);

      // Unsupported addresses are not signed
      if (addressType === "scAddressTypeContract") {
        if (!removeUnsigned) signedEntries.push(authEntry);
        continue;
      }

      if (addressType === "scAddressTypeClaimableBalance") {
        if (!removeUnsigned) signedEntries.push(authEntry);
        continue;
      }

      if (addressType === "scAddressTypeLiquidityPool") {
        if (!removeUnsigned) signedEntries.push(authEntry);
        continue;
      }

      if (addressType === "scAddressTypeMuxedAccount") {
        if (!removeUnsigned) signedEntries.push(authEntry);
        continue;
      }

      if (addressType === "scAddressTypeAccount") {
        const requiredSigner = getAddressSignerFromAuthEntry(authEntry);

        const signer = signers.find(
          (s) => s.publicKey() === requiredSigner
        ) as TransactionSigner;

        assert(signer, new E.MISSING_SIGNER(input, requiredSigner, authEntry));

        let signedEntry: xdr.SorobanAuthorizationEntry;
        try {
          signedEntry = await signer.signSorobanAuthEntry(
            authEntry,
            validUntilLedgerSeq,
            networkPassphrase
          );
        } catch (e) {
          throw new E.FAILED_TO_SIGN_AUTH_ENTRY(input, authEntry, e as Error);
        }

        signedEntries.push(signedEntry);
        continue;
      }
    }

    return [...sourceAccountEntries, ...signedEntries];
  } catch (e) {
    if (e instanceof E.SignAuthEntriesError) {
      throw e;
    }
    throw new E.UNEXPECTED_ERROR(input, e as Error);
  }
};

const getValidUntilLedgerSeq = async (
  validity: LedgerValidity | undefined,
  rpc: Server
): Promise<
  ResultOrError<number, SignAuthEntriesInput, E.SignAuthEntriesError>
> => {
  if (validity && "validUntilLedgerSeq" in validity) {
    const { validUntilLedgerSeq } = validity;
    if (validUntilLedgerSeq <= 0)
      return E.VALID_UNTIL_LEDGER_SEQ_TOO_LOW.deferInput(validUntilLedgerSeq);

    return ResultOrError.wrapVal(validUntilLedgerSeq);
  }

  let nOfLedgersToSignFor = 120; // default to ˜10min if no value is informed

  if (validity && "validForSeconds" in validity) {
    const { validForSeconds } = validity;
    if (validForSeconds <= 5)
      return E.VALID_FOR_SECONDS_TOO_LOW.deferInput(validForSeconds);

    nOfLedgersToSignFor = nOfLedgersToSignFor = Math.ceil(validForSeconds / 5);
  }

  if (validity && "validForLedgers" in validity) {
    const { validForLedgers } = validity;
    if (validForLedgers <= 0)
      return E.VALID_FOR_LEDGERS_TOO_LOW.deferInput(validForLedgers);

    nOfLedgersToSignFor = validForLedgers;
  }

  let latestLedger: Api.GetLatestLedgerResponse;
  try {
    latestLedger = await rpc.getLatestLedger();
  } catch (e) {
    return E.FAILED_TO_FETCH_LATEST_LEDGER.deferInput(e as Error);
  }

  const latestLedgerSeq = latestLedger.sequence;
  const validUntilLedgerSeq = latestLedgerSeq + nOfLedgersToSignFor;

  return ResultOrError.wrapVal(validUntilLedgerSeq);
};

const getSourceCredentialAuth = (
  authEntries: xdr.SorobanAuthorizationEntry[]
): xdr.SorobanAuthorizationEntry[] => {
  return authEntries.filter((entry) => {
    const credentials = entry.credentials();
    return (
      credentials.switch() ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount()
    );
  });
};

const getAddressCredentialAuth = (
  authEntries: xdr.SorobanAuthorizationEntry[]
): xdr.SorobanAuthorizationEntry[] => {
  return authEntries.filter((entry) => {
    const credentials = entry.credentials();
    return (
      credentials.switch() ===
      xdr.SorobanCredentialsType.sorobanCredentialsAddress()
    );
  });
};

const separateSignedAndUnsignedAuthEntries = (
  authEntries: xdr.SorobanAuthorizationEntry[]
): {
  signed: xdr.SorobanAuthorizationEntry[];
  unsigned: xdr.SorobanAuthorizationEntry[];
} => {
  const signed: xdr.SorobanAuthorizationEntry[] = [];
  const unsigned: xdr.SorobanAuthorizationEntry[] = [];

  for (const entry of authEntries) {
    const credentials = entry.credentials();

    const isSourceAccount =
      credentials.switch() ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount();

    // An entry is considered unsigned if it's not a source account and its signature is empty
    // A signature can be empty if it's either an empty vector or a void ScVal
    const isSignatureEmpty =
      !isSourceAccount &&
      (credentials.address().signature().toXDR("base64") ===
        xdr.ScVal.scvVec([]).toXDR("base64") ||
        credentials.address().signature().toXDR("base64") ===
          xdr.ScVal.scvVoid().toXDR("base64"));

    if (isSourceAccount || isSignatureEmpty) {
      unsigned.push(entry);
    } else {
      signed.push(entry);
    }
  }

  return { signed, unsigned };
};

const PROCESS_NAME = "SignAuthEntries" as const;

const P_SignAuthEntries = () =>
  ProcessEngine.create<
    SignAuthEntriesInput,
    SignAuthEntriesOutput,
    E.SignAuthEntriesError,
    typeof PROCESS_NAME
  >(signAuthEntriesProcess, { name: PROCESS_NAME });

const P_SignAuthEntriesErrors = E;

export { P_SignAuthEntries, P_SignAuthEntriesErrors };
