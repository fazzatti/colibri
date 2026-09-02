import { isKeypairSigner, StellarToml } from "@colibri/core";
import { authorizeEntry, type Keypair, xdr } from "stellar-sdk";
import {
  Sep45AuthorizedChallenge,
  Sep45Challenge,
  Sep45PreparedChallenge,
} from "@/sep45/challenge.ts";
import type { ContractAuthHandler } from "@/sep45/contract-auth.ts";
import { cloneSep45AuthorizationEntry } from "@/sep45/codec.ts";
import {
  hasSep45ClientDomainArguments,
  verifySep45Challenge,
} from "@/sep45/verify-challenge.ts";
import { simulateSep45Challenge } from "@/sep45/simulation.ts";
import type {
  Sep45AuthenticateOptions,
  Sep45AuthorizeChallengeOptions,
  Sep45ClientConfig,
  Sep45GetChallengeOptions,
} from "@/sep45/types.ts";
import { Sep45Code, Sep45Error, WebAuthCode, WebAuthError } from "@/error.ts";
import { WebAuthToken } from "@/token.ts";
import { WebAuthTransport } from "@/transport.ts";
import type { WebAuthCoreSigner } from "@/types.ts";
import { protocolForAccount } from "@/routing.ts";

const DEFAULT_VALIDITY_LEDGERS = 6;

interface ResolvedSep45ClientConfig
  extends Omit<Sep45ClientConfig, "submissionFormat"> {
  transport: WebAuthTransport;
  submissionFormat: NonNullable<Sep45ClientConfig["submissionFormat"]>;
}

function setExpiration(
  entry: xdr.SorobanAuthorizationEntry,
  expiration: number,
): xdr.SorobanAuthorizationEntry {
  const clone = cloneSep45AuthorizationEntry(entry);
  const credentials = clone.credentials;
  if (credentials.type !== "sorobanCredentialsAddress") {
    throw new Sep45Error({
      code: Sep45Code.UNSUPPORTED_CREDENTIAL_TYPE,
      message: "SEP-45 v0.1.1 supports only legacy address credentials",
      data: { credentialType: credentials.type },
    });
  }
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: credentials.address.address,
        nonce: credentials.address.nonce,
        signatureExpirationLedger: expiration,
        signature: credentials.address.signature,
      }),
    ),
    rootInvocation: clone.rootInvocation,
  });
}

async function signClientDomainEntry(
  entry: xdr.SorobanAuthorizationEntry,
  signer: Keypair | WebAuthCoreSigner,
  expectedAccount: string,
  expiration: number,
  networkPassphrase: string,
): Promise<xdr.SorobanAuthorizationEntry> {
  const publicKey = signer.publicKey();
  const matches = isKeypairSigner(signer)
    ? signer.signsFor(
      expectedAccount as Parameters<WebAuthCoreSigner["signsFor"]>[0],
    )
    : publicKey === expectedAccount;
  if (!matches) {
    throw new Sep45Error({
      code: Sep45Code.CLIENT_DOMAIN_SIGNING_KEY,
      message: "SEP-45 client-domain signer does not match the discovered key",
      data: { expected: expectedAccount, actual: publicKey },
    });
  }
  const expiringEntry = setExpiration(entry, expiration);
  if (isKeypairSigner(signer)) {
    const result = await signer.signSorobanAuthEntry(
      expiringEntry,
      expiration,
      networkPassphrase,
    );
    return xdr.SorobanAuthorizationEntry.fromXdr(
      (result as xdr.SorobanAuthorizationEntry).toXdr(),
    );
  }
  return await authorizeEntry(
    expiringEntry,
    signer,
    expiration,
    networkPassphrase,
  );
}

/** Client implementation for explicit draft SEP-45 v0.1.1 authentication. */
export class Sep45Client {
  readonly #config: ResolvedSep45ClientConfig;

  /** Creates a protocol client from validated WebAuth configuration. */
  constructor(config: Sep45ClientConfig) {
    this.#config = {
      ...config,
      transport: new WebAuthTransport({
        fetch: config.fetch,
        timeout: config.timeout,
      }),
      submissionFormat: config.submissionFormat ?? "json",
    };
  }

  /** SEP-45 endpoint. */
  get endpoint(): string {
    return this.#config.endpoint;
  }

  /** Configured WebAuth contract ID. */
  get webAuthContractId(): string {
    return this.#config.webAuthContractId;
  }

  /** Retrieves and fully verifies a SEP-45 challenge. */
  async getChallenge(
    options: Sep45GetChallengeOptions,
  ): Promise<Sep45Challenge> {
    if (protocolForAccount(options.account) !== "sep45") {
      throw new Sep45Error({
        code: Sep45Code.ACCOUNT_MISMATCH,
        message: "SEP-45 requires a C account",
        data: { account: options.account },
      });
    }
    const params = new URLSearchParams({
      account: options.account,
      home_domain: this.#config.homeDomain,
    });
    if (options.clientDomain !== undefined) {
      params.set("client_domain", options.clientDomain);
    }
    const response = await this.#config.transport.get(
      this.#config.endpoint,
      params,
      "sep45",
    );
    const authorizationEntriesXdr = response.body.authorization_entries;
    if (typeof authorizationEntriesXdr !== "string") {
      throw new Sep45Error({
        code: Sep45Code.CLIENT_REQUEST_FAILED,
        message: "SEP-45 response is missing authorization_entries XDR",
        endpoint: this.#config.endpoint,
      });
    }
    const responseNetwork = response.body.network_passphrase;
    if (
      responseNetwork !== undefined &&
      responseNetwork !== this.#config.networkPassphrase
    ) {
      throw new WebAuthError({
        code: WebAuthCode.NETWORK_MISMATCH,
        message: "SEP-45 response uses a different network",
        protocol: "sep45",
        endpoint: this.#config.endpoint,
        data: {
          expected: this.#config.networkPassphrase,
          actual: responseNetwork,
        },
      });
    }

    let clientDomainAccount: string | undefined;
    if (hasSep45ClientDomainArguments(authorizationEntriesXdr)) {
      if (!options.clientDomain) {
        throw new Sep45Error({
          code: Sep45Code.CLIENT_DOMAIN_UNEXPECTED,
          message: "SEP-45 server returned an unrequested client domain",
        });
      }
      try {
        const toml = await StellarToml.fromDomain(options.clientDomain, {
          fetchFn: this.#config.fetch,
          allowHttp: this.#config.allowHttp,
        });
        clientDomainAccount = toml.signingKey;
      } catch (cause) {
        throw new Sep45Error({
          code: Sep45Code.CLIENT_DOMAIN_DISCOVERY,
          message: "Could not discover the SEP-45 client-domain signing key",
          cause,
          data: { clientDomain: options.clientDomain },
        });
      }
      if (!clientDomainAccount) {
        throw new Sep45Error({
          code: Sep45Code.CLIENT_DOMAIN_SIGNING_KEY,
          message: "Client-domain stellar.toml has no valid signing key",
          data: { clientDomain: options.clientDomain },
        });
      }
    }

    let latestLedger: number;
    try {
      latestLedger = (await this.#config.rpc.getLatestLedger()).sequence;
    } catch (cause) {
      throw new Sep45Error({
        code: Sep45Code.RPC_FAILED,
        message: "Could not fetch the latest ledger for SEP-45 verification",
        cause,
      });
    }
    const verified = verifySep45Challenge({
      authorizationEntriesXdr,
      networkPassphrase: this.#config.networkPassphrase,
      webAuthContractId: this.#config.webAuthContractId,
      serverAccount: this.#config.serverAccount,
      account: options.account,
      homeDomain: this.#config.homeDomain,
      webAuthDomain: this.#config.webAuthDomain,
      clientDomain: options.clientDomain,
      clientDomainAccount,
      latestLedger,
    });
    return new Sep45Challenge(verified);
  }

  /** Runs the application authorization hook and signs an accepted client domain. */
  async authorizeChallenge(
    challenge: Sep45Challenge,
    authorize: ContractAuthHandler,
    options: Sep45AuthorizeChallengeOptions = {},
  ): Promise<Sep45AuthorizedChallenge> {
    if (!(challenge instanceof Sep45Challenge)) {
      throw new Sep45Error({
        code: Sep45Code.INVALID_STATE,
        message: "SEP-45 authorization requires a verified challenge",
      });
    }
    if (typeof authorize !== "function") {
      throw new Sep45Error({
        code: Sep45Code.AUTH_HANDLER_MISSING,
        message: "SEP-45 contract account requires an authorization handler",
      });
    }
    const validity = options.authorizationValidityLedgers ??
      DEFAULT_VALIDITY_LEDGERS;
    if (!Number.isInteger(validity) || validity <= 0) {
      throw new Sep45Error({
        code: Sep45Code.INVALID_VALIDITY,
        message:
          "SEP-45 authorizationValidityLedgers must be a positive integer",
        data: { authorizationValidityLedgers: validity },
      });
    }

    let latestLedger: number;
    try {
      latestLedger = (await this.#config.rpc.getLatestLedger()).sequence;
    } catch (cause) {
      throw new Sep45Error({
        code: Sep45Code.RPC_FAILED,
        message:
          "Could not fetch the latest ledger before SEP-45 authorization",
        cause,
      });
    }
    const verified = challenge.verified;
    if (latestLedger >= verified.serverExpirationLedger) {
      throw new Sep45Error({
        code: Sep45Code.SERVER_ENTRY_EXPIRED,
        message: "SEP-45 server entry expired before authorization",
        data: {
          latestLedger,
          serverExpirationLedger: verified.serverExpirationLedger,
        },
      });
    }
    const validUntilLedgerSeq = Math.min(
      latestLedger + validity,
      verified.serverExpirationLedger,
    );
    const entries = challenge.entries;
    const clientEntry = setExpiration(
      entries[verified.clientEntryIndex],
      validUntilLedgerSeq,
    );
    let returnedClient: xdr.SorobanAuthorizationEntry;
    try {
      returnedClient = await authorize(clientEntry, {
        networkPassphrase: this.#config.networkPassphrase,
        validUntilLedgerSeq,
      });
    } catch (cause) {
      throw new Sep45Error({
        code: Sep45Code.AUTH_HANDLER_FAILED,
        message: "SEP-45 contract authorization handler failed",
        cause,
      });
    }
    let authorizedClient: xdr.SorobanAuthorizationEntry;
    try {
      authorizedClient = xdr.SorobanAuthorizationEntry.fromXdr(
        returnedClient.toXdr(),
      );
    } catch (cause) {
      throw new Sep45Error({
        code: Sep45Code.INVALID_AUTHORIZED_ENTRY,
        message:
          "SEP-45 contract authorization handler returned an invalid entry",
        cause,
      });
    }
    entries[verified.clientEntryIndex] = authorizedClient;

    if (verified.clientDomainEntryIndex !== undefined) {
      if (!options.clientDomainSigner || !verified.clientDomainAccount) {
        throw new Sep45Error({
          code: Sep45Code.CLIENT_DOMAIN_SIGNER_MISSING,
          message: "Accepted SEP-45 client domain requires its signer",
        });
      }
      try {
        entries[verified.clientDomainEntryIndex] = await signClientDomainEntry(
          entries[verified.clientDomainEntryIndex],
          options.clientDomainSigner,
          verified.clientDomainAccount,
          validUntilLedgerSeq,
          this.#config.networkPassphrase,
        );
      } catch (cause) {
        if (cause instanceof Sep45Error) {
          throw cause;
        }
        throw new Sep45Error({
          code: Sep45Code.AUTH_HANDLER_FAILED,
          message: "Could not sign the SEP-45 client-domain entry",
          cause,
        });
      }
    }
    return new Sep45AuthorizedChallenge(
      verified,
      entries,
      validUntilLedgerSeq,
    );
  }

  /** Runs enforcing simulation and footprint checks. */
  async prepareChallenge(
    challenge: Sep45AuthorizedChallenge,
  ): Promise<Sep45PreparedChallenge> {
    if (!(challenge instanceof Sep45AuthorizedChallenge)) {
      throw new Sep45Error({
        code: Sep45Code.INVALID_STATE,
        message: "SEP-45 preparation requires an authorized challenge",
      });
    }
    const receipt = await simulateSep45Challenge(challenge, {
      rpc: this.#config.rpc,
      networkPassphrase: this.#config.networkPassphrase,
      webAuthContractId: this.#config.webAuthContractId,
    });
    return new Sep45PreparedChallenge(challenge, receipt);
  }

  /** Exchanges a prepared challenge for a context-validated WebAuth token. */
  async submitChallenge(
    challenge: Sep45PreparedChallenge,
  ): Promise<WebAuthToken> {
    if (!(challenge instanceof Sep45PreparedChallenge)) {
      throw new Sep45Error({
        code: Sep45Code.INVALID_STATE,
        message: "SEP-45 submission requires a prepared challenge",
      });
    }
    const response = await this.#config.transport.post(
      this.#config.endpoint,
      "authorization_entries",
      challenge.toXdr(),
      this.#config.submissionFormat,
      "sep45",
    );
    if (typeof response.body.token !== "string") {
      throw new Sep45Error({
        code: Sep45Code.CLIENT_REQUEST_FAILED,
        message: "SEP-45 response is missing a token",
        endpoint: this.#config.endpoint,
      });
    }
    const verified = challenge.authorized.verified;
    return WebAuthToken.authenticated(response.body.token, {
      protocol: "sep45",
      account: verified.account,
      homeDomain: verified.homeDomain,
      webAuthDomain: verified.webAuthDomain,
      clientDomain: verified.clientDomain,
    });
  }

  /** Runs the complete SEP-45 flow without protocol fallback. */
  async authenticate(
    options: Sep45AuthenticateOptions,
  ): Promise<WebAuthToken> {
    const challenge = await this.getChallenge(options);
    const authorized = await this.authorizeChallenge(
      challenge,
      options.authorize,
      options,
    );
    const prepared = await this.prepareChallenge(authorized);
    return await this.submitChallenge(prepared);
  }
}
