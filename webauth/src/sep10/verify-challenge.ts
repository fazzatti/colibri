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
    return TransactionBuilder.fromXdr(
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

const validateEnvelope = (
  transaction: Transaction,
  input: VerifySep10ChallengeInput,
): { minTime: number; maxTime: number } => {
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
    fail(Sep10Code.EXPIRED, "SEP-10 challenge has expired", { maxTime, now });
  }
  return { minTime, maxTime };
};

const validateFirstOperation = (
  transaction: Transaction,
  input: VerifySep10ChallengeInput,
): Operation.ManageData => {
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
  validateHomeDomain(first, input);
  if (!first.value || first.value.length !== NONCE_LENGTH) {
    fail(Sep10Code.INVALID_NONCE, "SEP-10 nonce must be 64 bytes", {
      actualLength: first.value?.length ?? 0,
    });
  }
  return first;
};

const validateHomeDomain = (
  operation: Operation.ManageData,
  input: VerifySep10ChallengeInput,
): void => {
  if (operation.name === `${input.homeDomain}${AUTH_SUFFIX}`) return;
  fail(
    Sep10Code.INVALID_HOME_DOMAIN,
    "SEP-10 challenge home domain does not match the client",
    {
      expected: input.homeDomain,
      actual: operation.name.endsWith(AUTH_SUFFIX)
        ? operation.name.slice(0, -AUTH_SUFFIX.length)
        : operation.name,
    },
  );
};

const validateMemo = (
  transaction: Transaction,
  input: VerifySep10ChallengeInput,
): void => {
  const actualMemo = transaction.memo.type === "id"
    ? String(transaction.memo.value)
    : undefined;
  const unexpectedMemo = input.memo === undefined &&
    transaction.memo.type !== "none";
  const mismatchedMemo = input.memo !== undefined &&
    (transaction.memo.type !== "id" || actualMemo !== input.memo);
  if (!unexpectedMemo && !mismatchedMemo) return;

  fail(
    Sep10Code.MEMO_MISMATCH,
    "SEP-10 challenge memo does not match the request",
    {
      expected: input.memo,
      actual: actualMemo,
      actualType: transaction.memo.type,
    },
  );
};

type Sep10ExtensionState = {
  webAuthDomain?: string;
  clientDomain?: string;
  clientDomainAccount?: string;
};

const readManageDataOperation = (
  operation: Transaction["operations"][number],
  index: number,
  transactionSource: string,
): { operation: Operation.ManageData; source: string; value?: string } => {
  if (operation.type !== "manageData") {
    fail(
      Sep10Code.INVALID_OPERATION,
      "Every later SEP-10 operation must be ManageData",
      { index, type: operation.type },
    );
  }
  return {
    operation,
    source: operation.source ?? transactionSource,
    value: operation.value
      ? new TextDecoder().decode(operation.value)
      : undefined,
  };
};

const applyExtensionOperation = (
  state: Sep10ExtensionState,
  operation: Operation.ManageData,
  source: string,
  value: string | undefined,
  index: number,
  input: VerifySep10ChallengeInput,
): void => {
  if (operation.name === "web_auth_domain") {
    if (
      state.webAuthDomain !== undefined ||
      source !== input.serverAccount ||
      value !== input.webAuthDomain
    ) {
      fail(
        Sep10Code.INVALID_WEB_AUTH_DOMAIN,
        "SEP-10 web-auth domain operation is invalid",
        { expected: input.webAuthDomain, actual: value, source },
      );
    }
    state.webAuthDomain = value;
    return;
  }
  if (operation.name === "client_domain") {
    applyClientDomainOperation(state, source, value, input);
    return;
  }
  if (source !== input.serverAccount) {
    fail(
      Sep10Code.INVALID_OPERATION,
      "SEP-10 extension operation has the wrong source",
      { index, key: operation.name, source },
    );
  }
};

const applyClientDomainOperation = (
  state: Sep10ExtensionState,
  source: string,
  value: string | undefined,
  input: VerifySep10ChallengeInput,
): void => {
  if (state.clientDomain !== undefined || input.clientDomain === undefined) {
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
  state.clientDomain = value;
  state.clientDomainAccount = source;
};

const readExtensionOperations = (
  transaction: Transaction,
  input: VerifySep10ChallengeInput,
):
  & Required<Pick<Sep10ExtensionState, "webAuthDomain">>
  & Sep10ExtensionState => {
  const state: Sep10ExtensionState = {};
  for (let index = 1; index < transaction.operations.length; index++) {
    const { operation, source, value } = readManageDataOperation(
      transaction.operations[index],
      index,
      transaction.source,
    );
    applyExtensionOperation(state, operation, source, value, index, input);
  }
  if (state.webAuthDomain === undefined) {
    fail(
      Sep10Code.INVALID_WEB_AUTH_DOMAIN,
      "SEP-10 challenge is missing the web-auth domain operation",
      { expected: input.webAuthDomain },
    );
  }
  return state as
    & Required<Pick<Sep10ExtensionState, "webAuthDomain">>
    & Sep10ExtensionState;
};

const verifyServerSignature = (
  transaction: Transaction,
  serverAccount: string,
): void => {
  const serverKey = Keypair.fromPublicKey(serverAccount);
  const transactionHash = transaction.hash();
  const valid = transaction.signatures.some((signature) =>
    serverKey.verify(transactionHash, signature.signature.toBytes())
  );
  if (!valid) {
    fail(
      Sep10Code.INVALID_SERVER_SIGNATURE,
      "SEP-10 challenge has no valid server signature",
      { serverAccount },
    );
  }
};

/** Verifies a SEP-10 challenge using low-level SDK XDR and crypto primitives. */
export function verifySep10Challenge(
  input: VerifySep10ChallengeInput,
): VerifiedSep10Challenge {
  const transaction = decodeTransaction(
    input.transactionXdr,
    input.networkPassphrase,
  );
  const { minTime, maxTime } = validateEnvelope(transaction, input);
  validateFirstOperation(transaction, input);
  validateMemo(transaction, input);
  const { webAuthDomain, clientDomain, clientDomainAccount } =
    readExtensionOperations(transaction, input);
  verifyServerSignature(transaction, input.serverAccount);

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
