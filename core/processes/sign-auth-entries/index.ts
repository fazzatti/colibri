import { xdr } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";
import type {
  LedgerValidity,
  SignAuthEntriesInput,
  SignAuthEntriesOutput,
} from "@/processes/sign-auth-entries/types.ts";
import * as E from "@/processes/sign-auth-entries/error.ts";
import { assert } from "@/common/assert/assert.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { getAddressSignerFromAuthEntry } from "@/common/helpers/xdr/get-address-signer-from-auth-entry.ts";
import { getAddressTypeFromAuthEntry } from "@/common/helpers/xdr/get-address-type-from-auth-entry.ts";
import {
  type AuthEntryAddressCredentials,
  tryGetAddressCredentialsFromAuthEntry,
} from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { ResultOrError } from "@/common/deferred/result-or-error.ts";

/** Signs Soroban authorization entries with the provided signers. */
export const signAuthEntries = async (
  input: SignAuthEntriesInput,
): Promise<SignAuthEntriesOutput> => {
  try {
    const { auth, rpc, signers, networkPassphrase, validity, removeUnsigned } =
      input;

    assertRequiredArgs(
      { auth, rpc, signers, networkPassphrase },
      (argName: string) => new E.MISSING_ARG(input, argName),
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

      if (
        addressType === "scAddressTypeAccount" ||
        addressType === "scAddressTypeContract"
      ) {
        const requiredSigner = getAddressSignerFromAuthEntry(authEntry);

        const signer = signers.find((s) => s.signsFor(requiredSigner));

        assert(signer, new E.MISSING_SIGNER(input, requiredSigner, authEntry));

        let signedEntry: xdr.SorobanAuthorizationEntry;
        try {
          signedEntry = await signer.signSorobanAuthEntry(
            authEntry,
            validUntilLedgerSeq,
            networkPassphrase,
          ) as xdr.SorobanAuthorizationEntry;
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
  rpc: Server,
): Promise<
  ResultOrError<number, SignAuthEntriesInput, E.SignAuthEntriesError>
> => {
  if (validity && "validUntilLedgerSeq" in validity) {
    const { validUntilLedgerSeq } = validity;
    if (validUntilLedgerSeq <= 0) {
      return E.VALID_UNTIL_LEDGER_SEQ_TOO_LOW.deferInput(validUntilLedgerSeq);
    }

    return ResultOrError.wrapVal(validUntilLedgerSeq);
  }

  let nOfLedgersToSignFor = 120; // default to ˜10min if no value is informed

  if (validity && "validForSeconds" in validity) {
    const { validForSeconds } = validity;
    if (validForSeconds <= 5) {
      return E.VALID_FOR_SECONDS_TOO_LOW.deferInput(validForSeconds);
    }

    nOfLedgersToSignFor = nOfLedgersToSignFor = Math.ceil(validForSeconds / 5);
  }

  if (validity && "validForLedgers" in validity) {
    const { validForLedgers } = validity;
    if (validForLedgers <= 0) {
      return E.VALID_FOR_LEDGERS_TOO_LOW.deferInput(validForLedgers);
    }

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
  authEntries: xdr.SorobanAuthorizationEntry[],
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
  authEntries: xdr.SorobanAuthorizationEntry[],
): xdr.SorobanAuthorizationEntry[] => {
  return authEntries.filter((entry) =>
    tryGetAddressCredentialsFromAuthEntry(entry) !== null
  );
};

const separateSignedAndUnsignedAuthEntries = (
  authEntries: xdr.SorobanAuthorizationEntry[],
): {
  signed: xdr.SorobanAuthorizationEntry[];
  unsigned: xdr.SorobanAuthorizationEntry[];
} => {
  const signed: xdr.SorobanAuthorizationEntry[] = [];
  const unsigned: xdr.SorobanAuthorizationEntry[] = [];

  for (const entry of authEntries) {
    const credentials = entry.credentials();

    const isSourceAccount = credentials.switch() ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount();

    const resolvedCredentials = isSourceAccount
      ? null
      : tryGetAddressCredentialsFromAuthEntry(entry);

    // Delegated entries may be signed at the top-level address or at any
    // nested delegate node. Preserve any entry that already contains at least
    // one signature because the account's authorization policy is not known
    // to Colibri.
    const isSignatureEmpty = resolvedCredentials
      ? getCredentialSignatures(resolvedCredentials).every(isEmptySignature)
      : false;

    if (isSourceAccount || isSignatureEmpty) {
      unsigned.push(entry);
    } else {
      signed.push(entry);
    }
  }

  return { signed, unsigned };
};

const getCredentialSignatures = (
  credentials: AuthEntryAddressCredentials,
): xdr.ScVal[] => {
  const signatures = [credentials.addressCredentials.signature()];

  if (credentials.type !== "addressWithDelegates") return signatures;

  const collectDelegateSignatures = (
    delegates: xdr.SorobanDelegateSignature[],
  ): void => {
    for (const delegate of delegates) {
      signatures.push(delegate.signature());
      collectDelegateSignatures(delegate.nestedDelegates());
    }
  };

  collectDelegateSignatures(credentials.delegates);
  return signatures;
};

const EMPTY_SIGNATURE_XDRS = new Set([
  xdr.ScVal.scvVec([]).toXDR("base64"),
  xdr.ScVal.scvVoid().toXDR("base64"),
]);

const isEmptySignature = (signature: xdr.ScVal): boolean =>
  EMPTY_SIGNATURE_XDRS.has(signature.toXDR("base64"));
/** Error constructors emitted by {@link signAuthEntries}. */
export const SignAuthEntriesErrors: typeof E = E;
