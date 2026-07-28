import { Buffer } from "buffer";
import {
  Keypair,
  type Operation,
  type Transaction,
  TransactionBuilder,
} from "stellar-sdk";
import { Sep10Code, Sep10Error } from "@/error.ts";
import type {
  VerifiedSep10Challenge,
  VerifySep10ChallengeInput,
} from "@/sep10/types.ts";

const AUTH_SUFFIX = " auth";
const NONCE_LENGTH = 64;

function fail(
  code: (typeof Sep10Code)[keyof typeof Sep10Code],
  message: string,
  data?: Record<string, unknown>,
  cause?: unknown,
): never {
  throw new Sep10Error({ code, message, data, cause });
}

function decodeTransaction(
  transactionXdr: string,
  networkPassphrase: string,
): Transaction {
  try {
    return TransactionBuilder.fromXDR(
      transactionXdr,
      networkPassphrase,
    ) as Transaction;
  } catch (cause) {
    return fail(
      Sep10Code.INVALID_XDR,
      "Invalid SEP-10 transaction XDR",
      undefined,
      cause,
    );
  }
}

/** Returns whether a decodable challenge contains a client-domain operation. */
export function hasSep10ClientDomainOperation(
  transactionXdr: string,
  networkPassphrase: string,
): boolean {
  const transaction = decodeTransaction(transactionXdr, networkPassphrase);
  return transaction.operations.some((operation) =>
    operation.type === "manageData" && operation.name === "client_domain"
  );
}

/** Verifies a SEP-10 challenge using low-level SDK XDR and crypto primitives. */
export function verifySep10Challenge(
  input: VerifySep10ChallengeInput,
): VerifiedSep10Challenge {
  const transaction = decodeTransaction(
    input.transactionXdr,
    input.networkPassphrase,
  );

  if (transaction.sequence !== "0") {
    fail(Sep10Code.INVALID_SEQUENCE, "SEP-10 sequence must be zero", {
      actual: transaction.sequence,
    });
  }
  if (transaction.source !== input.serverAccount) {
    fail(
      Sep10Code.INVALID_SERVER_ACCOUNT,
      "SEP-10 transaction source does not match the server signing key",
      { expected: input.serverAccount, actual: transaction.source },
    );
  }
  if (!transaction.timeBounds) {
    fail(
      Sep10Code.TIMEBOUNDS_MISSING,
      "SEP-10 challenge is missing time bounds",
    );
  }

  const minTime = Number(transaction.timeBounds.minTime);
  const maxTime = Number(transaction.timeBounds.maxTime);
  if (maxTime === 0) {
    fail(
      Sep10Code.TIMEBOUNDS_INFINITE,
      "SEP-10 challenge must have a finite maximum time",
    );
  }
  const now = input.now ?? Math.floor(Date.now() / 1_000);
  if (now < minTime) {
    fail(Sep10Code.NOT_YET_VALID, "SEP-10 challenge is not yet valid", {
      minTime,
      now,
    });
  }
  if (now > maxTime) {
    fail(Sep10Code.EXPIRED, "SEP-10 challenge has expired", {
      maxTime,
      now,
    });
  }

  if (transaction.operations.length === 0) {
    fail(Sep10Code.NO_OPERATIONS, "SEP-10 challenge has no operations");
  }
  const first = transaction.operations[0];
  if (first.type !== "manageData" || !first.source) {
    fail(
      Sep10Code.INVALID_OPERATION,
      "SEP-10 first operation must be sourced ManageData",
    );
  }
  if (first.source !== input.account) {
    fail(
      Sep10Code.ACCOUNT_MISMATCH,
      "SEP-10 challenge account does not match the request",
      { expected: input.account, actual: first.source },
    );
  }
  if (first.name !== `${input.homeDomain}${AUTH_SUFFIX}`) {
    fail(
      Sep10Code.INVALID_HOME_DOMAIN,
      "SEP-10 challenge home domain does not match the client",
      {
        expected: input.homeDomain,
        actual: first.name.endsWith(AUTH_SUFFIX)
          ? first.name.slice(0, -AUTH_SUFFIX.length)
          : first.name,
      },
    );
  }
  if (!first.value || first.value.length !== NONCE_LENGTH) {
    fail(Sep10Code.INVALID_NONCE, "SEP-10 nonce must be 64 bytes", {
      actualLength: first.value?.length ?? 0,
    });
  }

  const actualMemo = transaction.memo.type === "id"
    ? String(transaction.memo.value)
    : undefined;
  if (
    (input.memo === undefined && transaction.memo.type !== "none") ||
    (input.memo !== undefined &&
      (transaction.memo.type !== "id" || actualMemo !== input.memo))
  ) {
    fail(
      Sep10Code.MEMO_MISMATCH,
      "SEP-10 challenge memo does not match the request",
      {
        expected: input.memo,
        actual: actualMemo,
        actualType: transaction.memo.type,
      },
    );
  }

  let webAuthDomain: string | undefined;
  let clientDomain: string | undefined;
  let clientDomainAccount: string | undefined;
  for (let index = 1; index < transaction.operations.length; index++) {
    const operation = transaction.operations[index];
    if (operation.type !== "manageData") {
      fail(
        Sep10Code.INVALID_OPERATION,
        "Every later SEP-10 operation must be ManageData",
        { index, type: operation.type },
      );
    }
    const manageData = operation as Operation.ManageData;
    const source = manageData.source ?? transaction.source;
    const value = manageData.value
      ? Buffer.from(manageData.value).toString()
      : undefined;

    if (manageData.name === "web_auth_domain") {
      if (
        webAuthDomain !== undefined ||
        source !== input.serverAccount ||
        value !== input.webAuthDomain
      ) {
        fail(
          Sep10Code.INVALID_WEB_AUTH_DOMAIN,
          "SEP-10 web-auth domain operation is invalid",
          {
            expected: input.webAuthDomain,
            actual: value,
            source,
          },
        );
      }
      webAuthDomain = value;
      continue;
    }

    if (manageData.name === "client_domain") {
      if (clientDomain !== undefined || input.clientDomain === undefined) {
        fail(
          Sep10Code.CLIENT_DOMAIN_UNEXPECTED,
          "SEP-10 challenge contains an unexpected client domain",
        );
      }
      if (value !== input.clientDomain) {
        fail(
          Sep10Code.CLIENT_DOMAIN_VALUE_MISMATCH,
          "SEP-10 client domain does not match the request",
          { expected: input.clientDomain, actual: value },
        );
      }
      if (!input.clientDomainAccount || source !== input.clientDomainAccount) {
        fail(
          Sep10Code.CLIENT_DOMAIN_SIGNING_KEY,
          "SEP-10 client-domain operation has the wrong signing key",
          { expected: input.clientDomainAccount, actual: source },
        );
      }
      clientDomain = value;
      clientDomainAccount = source;
      continue;
    }

    if (source !== input.serverAccount) {
      fail(
        Sep10Code.INVALID_OPERATION,
        "SEP-10 extension operation has the wrong source",
        { index, key: manageData.name, source },
      );
    }
  }

  if (webAuthDomain === undefined) {
    fail(
      Sep10Code.INVALID_WEB_AUTH_DOMAIN,
      "SEP-10 challenge is missing the web-auth domain operation",
      { expected: input.webAuthDomain },
    );
  }

  const serverKey = Keypair.fromPublicKey(input.serverAccount);
  const transactionHash = transaction.hash();
  const validServerSignature = transaction.signatures.some((signature) =>
    serverKey.verify(transactionHash, signature.signature())
  );
  if (!validServerSignature) {
    fail(
      Sep10Code.INVALID_SERVER_SIGNATURE,
      "SEP-10 challenge has no valid server signature",
      { serverAccount: input.serverAccount },
    );
  }

  return {
    transaction,
    transactionXdr: input.transactionXdr,
    account: input.account,
    memo: input.memo,
    serverAccount: input.serverAccount,
    homeDomain: input.homeDomain,
    webAuthDomain,
    clientDomain,
    clientDomainAccount,
    minTime,
    maxTime,
  };
}
