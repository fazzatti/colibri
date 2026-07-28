import { Buffer } from "buffer";
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
  const credentialType = entry.credentials().switch().name;
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
  return entry.credentials().address();
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
  const invocation = entry.rootInvocation();
  if (invocation.subInvocations().length !== 0) {
    return fail(
      Sep45Code.INVALID_INVOCATION,
      "SEP-45 authorization entries cannot contain subinvocations",
    );
  }
  if (
    invocation.function().switch().name !==
      "sorobanAuthorizedFunctionTypeContractFn"
  ) {
    return fail(
      Sep45Code.INVALID_INVOCATION,
      "SEP-45 root invocation must be a contract function",
    );
  }
  const contractFunction = invocation.function().contractFn();
  const contractId = Address.fromScAddress(
    contractFunction.contractAddress(),
  ).toString();
  if (
    contractId !== webAuthContractId ||
    contractFunction.functionName().toString() !== "web_auth_verify"
  ) {
    return fail(
      Sep45Code.INVALID_INVOCATION,
      "SEP-45 invocation targets the wrong contract or function",
      {
        expectedContract: webAuthContractId,
        actualContract: contractId,
        actualFunction: contractFunction.functionName().toString(),
      },
    );
  }
  const args = contractFunction.args();
  if (args.length !== 1 || args[0].switch().name !== "scvMap") {
    return fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 web_auth_verify requires exactly one map argument",
    );
  }
  const map = args[0].map();
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
      item.key().switch().name !== "scvSymbol" ||
      item.val().switch().name !== "scvString"
    ) {
      return fail(
        Sep45Code.INVALID_ARGUMENTS,
        "SEP-45 map keys must be Symbols and values must be Strings",
      );
    }
    const key = item.key().sym().toString();
    if (Object.hasOwn(values, key)) {
      return fail(
        Sep45Code.INVALID_ARGUMENTS,
        "SEP-45 argument map contains a duplicate key",
        { key },
      );
    }
    values[key] = item.val().str().toString();
    encodedPairs.push(
      `${item.key().toXDR("hex")}:${item.val().toXDR("hex")}`,
    );
  }
  encodedPairs.sort();
  return {
    argument: xdr.ScVal.fromXDR(args[0].toXDR()),
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
  const expiration = credentials.signatureExpirationLedger();
  try {
    const nativeSignature = scValToNative(credentials.signature());
    if (!Array.isArray(nativeSignature)) {
      throw new TypeError("server signature is not a vector");
    }
    const expectedKey = StrKey.decodeEd25519PublicKey(serverAccount);
    const payload = hash(
      buildAuthorizationEntryPreimage(
        entry,
        expiration,
        networkPassphrase,
      ).toXDR(),
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
        Buffer.from(publicKey).equals(Buffer.from(expectedKey)) &&
        keypair.verify(payload, Buffer.from(signature))
      );
    });
    if (!valid) {
      throw new TypeError("no matching Ed25519 signature");
    }
    return expiration;
  } catch (cause) {
    return fail(
      Sep45Code.INVALID_SERVER_SIGNATURE,
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
    try {
      const invocation = entry.rootInvocation().function().contractFn();
      const map = invocation.args()[0]?.map();
      if (!map) {
        continue;
      }
      for (const item of map) {
        if (item.key().switch().name !== "scvSymbol") {
          continue;
        }
        const key = item.key().sym().toString();
        if (key === "client_domain" || key === "client_domain_account") {
          return true;
        }
      }
    } catch {
      continue;
    }
  }
  return false;
}

/** Verifies a draft SEP-45 v0.1.1 challenge without transport or RPC calls. */
export function verifySep45Challenge(
  input: VerifySep45ChallengeInput,
): VerifiedSep45Challenge {
  const entries = decodeSep45AuthorizationEntries(
    input.authorizationEntriesXdr,
  );
  let canonicalArguments: string | undefined;
  let firstInvocation: ParsedInvocation | undefined;
  let clientEntryIndex: number | undefined;
  let serverEntryIndex: number | undefined;
  let clientDomainEntryIndex: number | undefined;

  entries.forEach((entry, index) => {
    const credentials = legacyAddressCredentials(entry);
    const address = Address.fromScAddress(credentials.address()).toString();
    const invocation = parseInvocation(entry, input.webAuthContractId);
    if (
      canonicalArguments !== undefined &&
      invocation.canonical !== canonicalArguments
    ) {
      fail(
        Sep45Code.ARGUMENTS_MISMATCH,
        "SEP-45 authorization entries contain different argument maps",
        { index },
      );
    }
    canonicalArguments = invocation.canonical;
    firstInvocation ??= invocation;

    if (address === input.account) {
      if (clientEntryIndex !== undefined) {
        fail(
          Sep45Code.INVALID_ROLE,
          "SEP-45 challenge contains duplicate client entries",
        );
      }
      clientEntryIndex = index;
    } else if (address === input.serverAccount) {
      if (serverEntryIndex !== undefined) {
        fail(
          Sep45Code.INVALID_ROLE,
          "SEP-45 challenge contains duplicate server entries",
        );
      }
      serverEntryIndex = index;
    } else if (
      input.clientDomainAccount !== undefined &&
      address === input.clientDomainAccount
    ) {
      if (clientDomainEntryIndex !== undefined) {
        fail(
          Sep45Code.INVALID_ROLE,
          "SEP-45 challenge contains duplicate client-domain entries",
        );
      }
      clientDomainEntryIndex = index;
    }
  });

  if (
    firstInvocation === undefined ||
    clientEntryIndex === undefined ||
    serverEntryIndex === undefined
  ) {
    fail(
      Sep45Code.INVALID_ROLE,
      "SEP-45 challenge is missing a required client or server entry",
      {
        hasClient: clientEntryIndex !== undefined,
        hasServer: serverEntryIndex !== undefined,
      },
    );
  }

  const values = firstInvocation.values;
  requireArgument(
    values,
    "account",
    input.account,
    Sep45Code.ACCOUNT_MISMATCH,
  );
  requireArgument(values, "home_domain", input.homeDomain);
  requireArgument(values, "web_auth_domain", input.webAuthDomain);
  requireArgument(
    values,
    "web_auth_domain_account",
    input.serverAccount,
  );
  if (typeof values.nonce !== "string" || values.nonce.length === 0) {
    fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 nonce must be a non-empty string",
    );
  }

  const hasClientDomain = Object.hasOwn(values, "client_domain");
  const hasClientDomainAccount = Object.hasOwn(
    values,
    "client_domain_account",
  );
  if (hasClientDomain !== hasClientDomainAccount) {
    fail(
      Sep45Code.INVALID_ARGUMENTS,
      "SEP-45 client-domain arguments must appear together",
    );
  }
  if (hasClientDomain) {
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
  } else if (clientDomainEntryIndex !== undefined) {
    fail(
      Sep45Code.INVALID_ROLE,
      "SEP-45 client-domain entry has no matching arguments",
    );
  }

  const serverExpirationLedger = verifyServerSignature(
    entries[serverEntryIndex],
    input.serverAccount,
    input.networkPassphrase,
  );
  if (input.latestLedger >= serverExpirationLedger) {
    fail(
      Sep45Code.SERVER_ENTRY_EXPIRED,
      "SEP-45 server authorization entry has expired",
      {
        latestLedger: input.latestLedger,
        serverExpirationLedger,
      },
    );
  }

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
