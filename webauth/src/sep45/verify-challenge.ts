import {
  Address,
  buildAuthorizationEntryPreimage,
  hash,
  Keypair,
  scValToNative,
  StrKey,
  xdr,
} from "stellar-sdk";
import { Sep45Code, Sep45Error } from "@/error.ts";
import {
  decodeSep45AuthorizationEntries,
  encodeSep45AuthorizationEntries,
} from "@/sep45/codec.ts";
import type {
  VerifiedSep45Challenge,
  VerifySep45ChallengeInput,
} from "@/sep45/types.ts";

const KNOWN_ARGUMENTS = new Set([
  "account",
  "home_domain",
  "web_auth_domain",
  "web_auth_domain_account",
  "client_domain",
  "client_domain_account",
  "nonce",
]);

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length &&
    left.every((byte, index) => byte === right[index]);
}

function fail(
  code: (typeof Sep45Code)[keyof typeof Sep45Code],
  message: string,
  data?: Record<string, unknown>,
  cause?: unknown,
): never {
  throw new Sep45Error({ code, message, data, cause });
}

function legacyAddressCredentials(
  entry: xdr.SorobanAuthorizationEntry,
): xdr.SorobanAddressCredentials {
  const credentials = entry.credentials;
  const credentialType = credentials.type;
  if (credentialType === "sorobanCredentialsSourceAccount") {
    return fail(
      Sep45Code.INVALID_ROLE,
      "SEP-45 does not permit source-account credentials",
    );
  }
  if (credentialType !== "sorobanCredentialsAddress") {
    return fail(
      Sep45Code.UNSUPPORTED_CREDENTIAL_TYPE,
      "SEP-45 v0.1.1 supports only legacy address credentials",
      { credentialType },
    );
  }
  return credentials.address;
}

interface ParsedInvocation {
  argument: xdr.ScVal;
  values: Record<string, string>;
  canonical: string;
}

function parseInvocation(
  entry: xdr.SorobanAuthorizationEntry,
  webAuthContractId: string,
): ParsedInvocation {
  const invocation = entry.rootInvocation;
  if (invocation.subInvocations.length !== 0) {
    return fail(
      Sep45Code.INVALID_INVOCATION,
      "SEP-45 authorization entries cannot contain subinvocations",
    );
  }
  if (
    invocation.function.type !==
      "sorobanAuthorizedFunctionTypeContractFn"
  ) {
    return fail(
      Sep45Code.INVALID_INVOCATION,
      "SEP-45 root invocation must be a contract function",
    );
  }
  const contractFunction = invocation.function.contractFn;
  const contractId = Address.fromScAddress(
    contractFunction.contractAddress,
  ).toString();
  if (
    contractId !== webAuthContractId ||
    contractFunction.functionName.toString() !== "web_auth_verify"
  ) {
    return fail(
      Sep45Code.INVALID_INVOCATION,
      "SEP-45 invocation targets the wrong contract or function",
      {
        expectedContract: webAuthContractId,
        actualContract: contractId,
        actualFunction: contractFunction.functionName.toString(),
      },
    );
  }
  const args = contractFunction.args;
  if (args.length !== 1 || args[0].type !== "scvMap") {
    return fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 web_auth_verify requires exactly one map argument",
    );
  }
  const map = args[0].map;
  if (!map) {
    return fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 argument map cannot be null",
    );
  }
  const values: Record<string, string> = {};
  const encodedPairs: string[] = [];
  for (const item of map) {
    if (
      item.key.type !== "scvSymbol" ||
      item.val.type !== "scvString"
    ) {
      return fail(
        Sep45Code.INVALID_ARGUMENTS,
        "SEP-45 map keys must be Symbols and values must be Strings",
      );
    }
    const key = item.key.sym.toString();
    if (Object.hasOwn(values, key)) {
      return fail(
        Sep45Code.INVALID_ARGUMENTS,
        "SEP-45 argument map contains a duplicate key",
        { key },
      );
    }
    values[key] = item.val.str.toString();
    encodedPairs.push(
      `${item.key.toXdr("hex")}:${item.val.toXdr("hex")}`,
    );
  }
  encodedPairs.sort();
  return {
    argument: xdr.ScVal.fromXdr(args[0].toXdr()),
    values,
    canonical: encodedPairs.join("|"),
  };
}

function requireArgument(
  values: Record<string, string>,
  key: string,
  expected: string,
  mismatchCode:
    | typeof Sep45Code.INVALID_ARGUMENTS
    | typeof Sep45Code.ACCOUNT_MISMATCH = Sep45Code.INVALID_ARGUMENTS,
): void {
  if (values[key] !== expected) {
    fail(mismatchCode, `SEP-45 ${key} argument does not match`, {
      key,
      expected,
      actual: values[key],
    });
  }
}

function verifyServerSignature(
  entry: xdr.SorobanAuthorizationEntry,
  serverAccount: string,
  networkPassphrase: string,
): number {
  const credentials = legacyAddressCredentials(entry);
  const expiration = credentials.signatureExpirationLedger;
  try {
    const nativeSignature = scValToNative(credentials.signature);
    if (!Array.isArray(nativeSignature)) {
      return fail(
        Sep45Code.SERVER_SIGNATURE_NOT_VECTOR,
        "SEP-45 server signature must be a vector",
        { serverAccount },
      );
    }
    const expectedKey = StrKey.decodeEd25519PublicKey(serverAccount);
    const payload = hash(
      buildAuthorizationEntryPreimage(
        entry,
        expiration,
        networkPassphrase,
      ).toXdr(),
    );
    const keypair = Keypair.fromPublicKey(serverAccount);
    const valid = nativeSignature.some((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return false;
      }
      const record = candidate as Record<string, unknown>;
      const publicKey = record.public_key;
      const signature = record.signature;
      return (
        publicKey instanceof Uint8Array &&
        signature instanceof Uint8Array &&
        equalBytes(publicKey, expectedKey) &&
        keypair.verify(payload, signature)
      );
    });
    if (!valid) {
      return fail(
        Sep45Code.NO_MATCHING_SERVER_SIGNATURE,
        "SEP-45 server entry has no matching Ed25519 signature",
        { serverAccount },
      );
    }
    return expiration;
  } catch (cause) {
    if (cause instanceof Sep45Error) {
      throw cause;
    }
    return fail(
      Sep45Code.FAILED_TO_VERIFY_SERVER_SIGNATURE,
      "SEP-45 server entry has an invalid signature",
      { serverAccount },
      cause,
    );
  }
}

/** Reports whether the untrusted wire data advertises client-domain fields. */
export function hasSep45ClientDomainArguments(
  authorizationEntriesXdr: string,
): boolean {
  const entries = decodeSep45AuthorizationEntries(authorizationEntriesXdr);
  for (const entry of entries) {
    const authorizedFunction = entry.rootInvocation.function;
    if (
      authorizedFunction.type !==
        "sorobanAuthorizedFunctionTypeContractFn"
    ) {
      continue;
    }
    const invocation = authorizedFunction.contractFn;
    const firstArgument = invocation.args[0];
    const map = firstArgument?.type === "scvMap"
      ? firstArgument.map
      : undefined;
    if (!map) {
      continue;
    }
    for (const item of map) {
      if (item.key.type !== "scvSymbol") {
        continue;
      }
      const key = item.key.sym.toString();
      if (key === "client_domain" || key === "client_domain_account") {
        return true;
      }
    }
  }
  return false;
}

interface IndexedSep45Entries {
  canonicalArguments?: string;
  firstInvocation?: ParsedInvocation;
  clientEntryIndex?: number;
  serverEntryIndex?: number;
  clientDomainEntryIndex?: number;
}

interface CompleteSep45Entries extends IndexedSep45Entries {
  canonicalArguments: string;
  firstInvocation: ParsedInvocation;
  clientEntryIndex: number;
  serverEntryIndex: number;
}

const requireCanonicalInvocation = (
  state: IndexedSep45Entries,
  invocation: ParsedInvocation,
  index: number,
): void => {
  if (
    state.canonicalArguments !== undefined &&
    invocation.canonical !== state.canonicalArguments
  ) {
    fail(
      Sep45Code.ARGUMENTS_MISMATCH,
      "SEP-45 authorization entries contain different argument maps",
      { index },
    );
  }
  state.canonicalArguments = invocation.canonical;
  state.firstInvocation ??= invocation;
};

const assignEntryRole = (
  state: IndexedSep45Entries,
  address: string,
  index: number,
  input: VerifySep45ChallengeInput,
): void => {
  if (address === input.account) {
    if (state.clientEntryIndex !== undefined) {
      fail(
        Sep45Code.INVALID_ROLE,
        "SEP-45 challenge contains duplicate client entries",
      );
    }
    state.clientEntryIndex = index;
    return;
  }
  if (address === input.serverAccount) {
    if (state.serverEntryIndex !== undefined) {
      fail(
        Sep45Code.INVALID_ROLE,
        "SEP-45 challenge contains duplicate server entries",
      );
    }
    state.serverEntryIndex = index;
    return;
  }
  if (input.clientDomainAccount === undefined) return;
  if (address !== input.clientDomainAccount) return;
  if (state.clientDomainEntryIndex !== undefined) {
    fail(
      Sep45Code.INVALID_ROLE,
      "SEP-45 challenge contains duplicate client-domain entries",
    );
  }
  state.clientDomainEntryIndex = index;
};

const indexSep45Entries = (
  entries: readonly xdr.SorobanAuthorizationEntry[],
  input: VerifySep45ChallengeInput,
): CompleteSep45Entries => {
  const state: IndexedSep45Entries = {};
  for (const [index, entry] of entries.entries()) {
    const credentials = legacyAddressCredentials(entry);
    const address = Address.fromScAddress(credentials.address).toString();
    const invocation = parseInvocation(entry, input.webAuthContractId);
    requireCanonicalInvocation(state, invocation, index);
    assignEntryRole(state, address, index, input);
  }

  if (
    state.firstInvocation === undefined ||
    state.clientEntryIndex === undefined ||
    state.serverEntryIndex === undefined
  ) {
    fail(
      Sep45Code.INVALID_ROLE,
      "SEP-45 challenge is missing a required client or server entry",
      {
        hasClient: state.clientEntryIndex !== undefined,
        hasServer: state.serverEntryIndex !== undefined,
      },
    );
  }
  return state as CompleteSep45Entries;
};

const validateSep45Arguments = (
  values: Record<string, string>,
  input: VerifySep45ChallengeInput,
): void => {
  requireArgument(values, "account", input.account, Sep45Code.ACCOUNT_MISMATCH);
  requireArgument(values, "home_domain", input.homeDomain);
  requireArgument(values, "web_auth_domain", input.webAuthDomain);
  requireArgument(values, "web_auth_domain_account", input.serverAccount);
  if (typeof values.nonce !== "string" || values.nonce.length === 0) {
    fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 nonce must be a non-empty string",
    );
  }
};

const validateClientDomain = (
  values: Record<string, string>,
  clientDomainEntryIndex: number | undefined,
  input: VerifySep45ChallengeInput,
): boolean => {
  const hasClientDomain = Object.hasOwn(values, "client_domain");
  const hasClientDomainAccount = Object.hasOwn(values, "client_domain_account");
  if (hasClientDomain !== hasClientDomainAccount) {
    fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 client-domain arguments must appear together",
    );
  }
  if (!hasClientDomain) {
    if (clientDomainEntryIndex !== undefined) {
      fail(
        Sep45Code.INVALID_ROLE,
        "SEP-45 client-domain entry has no matching arguments",
      );
    }
    return false;
  }
  validateRequestedClientDomain(values, clientDomainEntryIndex, input);
  return true;
};

const validateRequestedClientDomain = (
  values: Record<string, string>,
  clientDomainEntryIndex: number | undefined,
  input: VerifySep45ChallengeInput,
): void => {
  if (!input.clientDomain) {
    fail(
      Sep45Code.CLIENT_DOMAIN_UNEXPECTED,
      "SEP-45 challenge contains an unrequested client domain",
    );
  }
  requireArgument(values, "client_domain", input.clientDomain);
  if (!input.clientDomainAccount) {
    fail(
      Sep45Code.CLIENT_DOMAIN_SIGNING_KEY,
      "SEP-45 client-domain signing key was not discovered",
    );
  }
  requireArgument(
    values,
    "client_domain_account",
    input.clientDomainAccount,
  );
  if (clientDomainEntryIndex === undefined) {
    fail(
      Sep45Code.INVALID_ROLE,
      "SEP-45 challenge is missing the client-domain entry",
    );
  }
};

const requireUnexpiredServerEntry = (
  entry: xdr.SorobanAuthorizationEntry,
  input: VerifySep45ChallengeInput,
): number => {
  const expiration = verifyServerSignature(
    entry,
    input.serverAccount,
    input.networkPassphrase,
  );
  if (input.latestLedger >= expiration) {
    fail(
      Sep45Code.SERVER_ENTRY_EXPIRED,
      "SEP-45 server authorization entry has expired",
      { latestLedger: input.latestLedger, serverExpirationLedger: expiration },
    );
  }
  return expiration;
};

/** Verifies a draft SEP-45 v0.1.1 challenge without transport or RPC calls. */
export function verifySep45Challenge(
  input: VerifySep45ChallengeInput,
): VerifiedSep45Challenge {
  const entries = decodeSep45AuthorizationEntries(
    input.authorizationEntriesXdr,
  );
  const indexed = indexSep45Entries(entries, input);
  const { firstInvocation, clientEntryIndex, serverEntryIndex } = indexed;
  const clientDomainEntryIndex = indexed.clientDomainEntryIndex;
  const values = firstInvocation.values;
  validateSep45Arguments(values, input);
  const hasClientDomain = validateClientDomain(
    values,
    clientDomainEntryIndex,
    input,
  );
  const serverExpirationLedger = requireUnexpiredServerEntry(
    entries[serverEntryIndex],
    input,
  );

  const extensionArguments = Object.fromEntries(
    Object.entries(values).filter(([key]) => !KNOWN_ARGUMENTS.has(key)),
  );
  return {
    authorizationEntriesXdr: encodeSep45AuthorizationEntries(entries),
    entries,
    invocationArgument: firstInvocation.argument,
    arguments: Object.freeze({ ...values }),
    extensionArguments: Object.freeze(extensionArguments),
    clientEntryIndex,
    serverEntryIndex,
    clientDomainEntryIndex,
    account: input.account,
    serverAccount: input.serverAccount,
    homeDomain: input.homeDomain,
    webAuthDomain: input.webAuthDomain,
    clientDomain: hasClientDomain ? input.clientDomain : undefined,
    clientDomainAccount: hasClientDomain
      ? input.clientDomainAccount
      : undefined,
    serverExpirationLedger,
  };
}
