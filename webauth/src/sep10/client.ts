import { StellarToml } from "@colibri/core";
import { sep10SignerKey, signSep10Transaction } from "@/sep10/signing.ts";
import { Sep10Challenge, Sep10SignedChallenge } from "@/sep10/challenge.ts";
import {
  hasSep10ClientDomainOperation,
  verifySep10Challenge,
} from "@/sep10/verify-challenge.ts";
import type {
  Sep10AuthenticateOptions,
  Sep10ClientConfig,
  Sep10GetChallengeOptions,
} from "@/sep10/types.ts";
import {
  Sep10AccountMismatchError,
  Sep10ClientDomainDiscoveryError,
  Sep10ClientDomainSignerMissingError,
  Sep10ClientDomainSigningKeyError,
  Sep10ClientDomainUnexpectedError,
  Sep10ClientRequestFailedError,
  Sep10Error,
  Sep10InvalidStateError,
  Sep10SigningFailedError,
  WebAuthNetworkMismatchError,
  WebAuthOptionMismatchError,
} from "@/error.ts";
import { WebAuthToken } from "@/token.ts";
import { WebAuthTransport } from "@/transport.ts";
import type { Sep10Signer } from "@/types.ts";
import { protocolForAccount } from "@/routing.ts";

interface ResolvedSep10ClientConfig
  extends Omit<Sep10ClientConfig, "submissionFormat"> {
  transport: WebAuthTransport;
  submissionFormat: NonNullable<Sep10ClientConfig["submissionFormat"]>;
}

/** Client implementation for explicit SEP-10 authentication. */
export class Sep10Client {
  readonly #config: ResolvedSep10ClientConfig;

  /** Creates a protocol client from validated WebAuth configuration. */
  constructor(config: Sep10ClientConfig) {
    this.#config = {
      ...config,
      transport: new WebAuthTransport({
        fetch: config.fetch,
        timeout: config.timeout,
      }),
      submissionFormat: config.submissionFormat ?? "json",
    };
  }

  /** SEP-10 endpoint. */
  get endpoint(): string {
    return this.#config.endpoint;
  }

  /** Retrieves and fully verifies a SEP-10 challenge. */
  async getChallenge(
    options: Sep10GetChallengeOptions,
  ): Promise<Sep10Challenge> {
    if (protocolForAccount(options.account) !== "sep10") {
      throw new Sep10AccountMismatchError({
        message: "SEP-10 requires a G or M account",
        data: { account: options.account },
      });
    }
    if (options.account.startsWith("M") && options.memo !== undefined) {
      throw new WebAuthOptionMismatchError({
        message: "Muxed SEP-10 accounts cannot use a memo",
        protocol: "sep10",
      });
    }

    const params = new URLSearchParams({
      account: options.account,
      home_domain: this.#config.homeDomain,
    });
    if (options.memo !== undefined) {
      params.set("memo", options.memo);
    }
    if (options.clientDomain !== undefined) {
      params.set("client_domain", options.clientDomain);
    }
    const response = await this.#config.transport.get(
      this.#config.endpoint,
      params,
      "sep10",
    );
    const transactionXdr = response.body.transaction;
    if (typeof transactionXdr !== "string") {
      throw new Sep10ClientRequestFailedError({
        message: "SEP-10 response is missing transaction XDR",
        endpoint: this.#config.endpoint,
      });
    }
    const responseNetwork = response.body.network_passphrase;
    if (
      responseNetwork !== undefined &&
      responseNetwork !== this.#config.networkPassphrase
    ) {
      throw new WebAuthNetworkMismatchError({
        message: "SEP-10 response uses a different network",
        protocol: "sep10",
        endpoint: this.#config.endpoint,
        data: {
          expected: this.#config.networkPassphrase,
          actual: responseNetwork,
        },
      });
    }

    let clientDomainAccount: string | undefined;
    if (
      hasSep10ClientDomainOperation(
        transactionXdr,
        this.#config.networkPassphrase,
      )
    ) {
      if (!options.clientDomain) {
        throw new Sep10ClientDomainUnexpectedError({
          message: "SEP-10 server returned an unrequested client domain",
        });
      }
      try {
        const toml = await StellarToml.fromDomain(options.clientDomain, {
          fetchFn: this.#config.fetch,
          allowHttp: this.#config.allowHttp,
        });
        clientDomainAccount = toml.signingKey;
      } catch (cause) {
        throw new Sep10ClientDomainDiscoveryError({
          message: "Could not discover the SEP-10 client-domain signing key",
          cause,
          data: { clientDomain: options.clientDomain },
        });
      }
      if (!clientDomainAccount) {
        throw new Sep10ClientDomainSigningKeyError({
          message: "Client-domain stellar.toml has no valid signing key",
          data: { clientDomain: options.clientDomain },
        });
      }
    }

    const verified = verifySep10Challenge({
      transactionXdr,
      networkPassphrase: this.#config.networkPassphrase,
      serverAccount: this.#config.serverAccount,
      account: options.account,
      memo: options.memo,
      homeDomain: this.#config.homeDomain,
      webAuthDomain: this.#config.webAuthDomain,
      clientDomain: options.clientDomain,
      clientDomainAccount,
    });
    return new Sep10Challenge(verified, this.#config.networkPassphrase);
  }

  /** Signs a verified challenge without mutating it. */
  async signChallenge(
    challenge: Sep10Challenge,
    signer: Sep10Signer | Sep10Signer[],
    clientDomainSigner?: Sep10Signer,
    signal?: AbortSignal,
  ): Promise<Sep10SignedChallenge> {
    if (!(challenge instanceof Sep10Challenge)) {
      throw new Sep10InvalidStateError({
        message: "SEP-10 signing requires a verified challenge",
      });
    }
    const signers = Array.isArray(signer) ? signer : [signer];
    if (signers.length === 0) {
      throw new Sep10SigningFailedError({
        message: "SEP-10 requires at least one account signer",
      });
    }
    // Revalidate immediately before approval, including challenges retained by
    // callers between the explicit get/sign steps.
    signal?.throwIfAborted();
    this.#verifyCurrent(challenge.verified);
    let transaction = challenge.transaction;
    try {
      if (challenge.clientDomainAccount) {
        if (!clientDomainSigner) {
          throw new Sep10ClientDomainSignerMissingError({
            message: "Accepted SEP-10 client domain requires its signer",
          });
        }
        const publicKey = sep10SignerKey(clientDomainSigner);
        const signsForDomain = publicKey === challenge.clientDomainAccount;
        if (!signsForDomain) {
          throw new Sep10ClientDomainSigningKeyError({
            message: "Client-domain signer does not match the discovered key",
            data: {
              expected: challenge.clientDomainAccount,
              actual: publicKey,
            },
          });
        }
      }
      // Resolve every signer identity before the first wallet approval. A
      // multisig signer's membership/weight remains the server's responsibility.
      for (const accountSigner of signers) sep10SignerKey(accountSigner);
      for (const accountSigner of signers) {
        transaction = await signSep10Transaction(transaction, accountSigner);
        signal?.throwIfAborted();
        this.#verifyCurrent(challenge.verified);
      }
      if (challenge.clientDomainAccount && clientDomainSigner) {
        transaction = await signSep10Transaction(
          transaction,
          clientDomainSigner,
        );
        signal?.throwIfAborted();
        this.#verifyCurrent(challenge.verified);
      }
    } catch (cause) {
      signal?.throwIfAborted();
      if (cause instanceof Sep10Error) {
        throw cause;
      }
      throw new Sep10SigningFailedError({
        message: "Could not sign the SEP-10 challenge",
        cause,
      });
    }
    return new Sep10SignedChallenge(
      transaction.toXdr(),
      challenge.verified,
      challenge.networkPassphrase,
    );
  }

  /** Exchanges a signed challenge for a context-validated WebAuth token. */
  async submitChallenge(
    challenge: Sep10SignedChallenge,
  ): Promise<WebAuthToken> {
    if (!(challenge instanceof Sep10SignedChallenge)) {
      throw new Sep10InvalidStateError({
        message: "SEP-10 submission requires a signed challenge",
      });
    }
    this.#verifyCurrent(challenge.verified);
    const response = await this.#config.transport.post(
      this.#config.endpoint,
      "transaction",
      challenge.toXdr(),
      this.#config.submissionFormat,
      "sep10",
    );
    if (typeof response.body.token !== "string") {
      throw new Sep10ClientRequestFailedError({
        message: "SEP-10 response is missing a token",
        endpoint: this.#config.endpoint,
      });
    }
    const verified = challenge.verified;
    return WebAuthToken.authenticated(response.body.token, {
      protocol: "sep10",
      account: verified.account,
      memo: verified.memo,
      homeDomain: verified.homeDomain,
      webAuthDomain: verified.webAuthDomain,
      clientDomain: verified.clientDomain,
    });
  }

  #verifyCurrent(verified: Sep10Challenge["verified"]): void {
    verifySep10Challenge({
      ...verified,
      serverAccount: this.#config.serverAccount,
      homeDomain: this.#config.homeDomain,
      webAuthDomain: this.#config.webAuthDomain,
      networkPassphrase: this.#config.networkPassphrase,
    });
  }

  /** Runs the complete SEP-10 challenge, signing, and exchange flow. */
  async authenticate(
    options: Sep10AuthenticateOptions,
  ): Promise<WebAuthToken> {
    options.signal?.throwIfAborted();
    const challenge = await this.getChallenge(options);
    options.signal?.throwIfAborted();
    const signed = await this.signChallenge(
      challenge,
      options.signer,
      options.clientDomainSigner,
      options.signal,
    );
    options.signal?.throwIfAborted();
    return await this.submitChallenge(signed);
  }
}
