import { Buffer } from "buffer";
import {
  isKeypairSigner,
  normalizeBinaryData,
  StellarToml,
} from "@colibri/core";
import { Keypair as StellarKeypair, xdr } from "stellar-sdk";
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
import { Sep10Code, Sep10Error, WebAuthCode, WebAuthError } from "@/error.ts";
import { WebAuthToken } from "@/token.ts";
import { WebAuthTransport } from "@/transport.ts";
import type { WebAuthCoreSigner } from "@/types.ts";
import { protocolForAccount } from "@/routing.ts";
import type { Keypair, Transaction } from "@/stellar-sdk-types.ts";

interface ResolvedSep10ClientConfig
  extends Omit<Sep10ClientConfig, "submissionFormat"> {
  transport: WebAuthTransport;
  submissionFormat: NonNullable<Sep10ClientConfig["submissionFormat"]>;
}

function signerPublicKey(signer: Keypair | WebAuthCoreSigner): string {
  return signer.publicKey();
}

function signTransaction(
  transaction: Transaction,
  signer: Keypair | WebAuthCoreSigner,
): void {
  if (!isKeypairSigner(signer)) {
    transaction.sign(signer);
    return;
  }
  const signature = Buffer.from(
    normalizeBinaryData(signer.sign(normalizeBinaryData(transaction.hash()))),
  );
  const hint = StellarKeypair.fromPublicKey(signer.publicKey()).signatureHint();
  transaction.signatures.push(new xdr.DecoratedSignature({ hint, signature }));
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
      throw new Sep10Error({
        code: Sep10Code.ACCOUNT_MISMATCH,
        message: "SEP-10 requires a G or M account",
        data: { account: options.account },
      });
    }
    if (options.account.startsWith("M") && options.memo !== undefined) {
      throw new WebAuthError({
        code: WebAuthCode.OPTION_MISMATCH,
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
      throw new Sep10Error({
        code: Sep10Code.CLIENT_REQUEST_FAILED,
        message: "SEP-10 response is missing transaction XDR",
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
        throw new Sep10Error({
          code: Sep10Code.CLIENT_DOMAIN_UNEXPECTED,
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
        throw new Sep10Error({
          code: Sep10Code.CLIENT_DOMAIN_DISCOVERY,
          message: "Could not discover the SEP-10 client-domain signing key",
          cause,
          data: { clientDomain: options.clientDomain },
        });
      }
      if (!clientDomainAccount) {
        throw new Sep10Error({
          code: Sep10Code.CLIENT_DOMAIN_SIGNING_KEY,
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
  // The explicit lifecycle remains promise-based even though current signers
  // complete this transition synchronously.
  // deno-lint-ignore require-await
  async signChallenge(
    challenge: Sep10Challenge,
    signer:
      | Keypair
      | WebAuthCoreSigner
      | Array<Keypair | WebAuthCoreSigner>,
    clientDomainSigner?: Keypair | WebAuthCoreSigner,
  ): Promise<Sep10SignedChallenge> {
    if (!(challenge instanceof Sep10Challenge)) {
      throw new Sep10Error({
        code: Sep10Code.INVALID_STATE,
        message: "SEP-10 signing requires a verified challenge",
      });
    }
    const signers = Array.isArray(signer) ? signer : [signer];
    if (signers.length === 0) {
      throw new Sep10Error({
        code: Sep10Code.SIGNING_FAILED,
        message: "SEP-10 requires at least one account signer",
      });
    }
    const transaction = challenge.transaction;
    try {
      for (const accountSigner of signers) {
        signTransaction(transaction, accountSigner);
      }
      if (challenge.clientDomainAccount) {
        if (!clientDomainSigner) {
          throw new Sep10Error({
            code: Sep10Code.CLIENT_DOMAIN_SIGNER_MISSING,
            message: "Accepted SEP-10 client domain requires its signer",
          });
        }
        const publicKey = signerPublicKey(clientDomainSigner);
        const signsForDomain = isKeypairSigner(clientDomainSigner)
          ? clientDomainSigner.signsFor(
            challenge.clientDomainAccount as ReturnType<
              WebAuthCoreSigner["publicKey"]
            >,
          )
          : publicKey === challenge.clientDomainAccount;
        if (!signsForDomain) {
          throw new Sep10Error({
            code: Sep10Code.CLIENT_DOMAIN_SIGNING_KEY,
            message: "Client-domain signer does not match the discovered key",
            data: {
              expected: challenge.clientDomainAccount,
              actual: publicKey,
            },
          });
        }
        signTransaction(transaction, clientDomainSigner);
      }
    } catch (cause) {
      if (cause instanceof Sep10Error) {
        throw cause;
      }
      throw new Sep10Error({
        code: Sep10Code.SIGNING_FAILED,
        message: "Could not sign the SEP-10 challenge",
        cause,
      });
    }
    return new Sep10SignedChallenge(
      transaction.toXDR(),
      challenge.verified,
      challenge.networkPassphrase,
    );
  }

  /** Exchanges a signed challenge for a context-validated WebAuth token. */
  async submitChallenge(
    challenge: Sep10SignedChallenge,
  ): Promise<WebAuthToken> {
    if (!(challenge instanceof Sep10SignedChallenge)) {
      throw new Sep10Error({
        code: Sep10Code.INVALID_STATE,
        message: "SEP-10 submission requires a signed challenge",
      });
    }
    const response = await this.#config.transport.post(
      this.#config.endpoint,
      "transaction",
      challenge.toXDR(),
      this.#config.submissionFormat,
      "sep10",
    );
    if (typeof response.body.token !== "string") {
      throw new Sep10Error({
        code: Sep10Code.CLIENT_REQUEST_FAILED,
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

  /** Runs the complete SEP-10 challenge, signing, and exchange flow. */
  async authenticate(
    options: Sep10AuthenticateOptions,
  ): Promise<WebAuthToken> {
    const challenge = await this.getChallenge(options);
    const signed = await this.signChallenge(
      challenge,
      options.signer,
      options.clientDomainSigner,
    );
    return await this.submitChallenge(signed);
  }
}
