import type { Transaction } from "stellar-sdk";
import { TransactionBuilder } from "stellar-sdk";
import type { VerifiedSep10Challenge } from "@/sep10/types.ts";

function cloneTransaction(
  transactionXdr: string,
  networkPassphrase: string,
): Transaction {
  return TransactionBuilder.fromXDR(
    transactionXdr,
    networkPassphrase,
  ) as Transaction;
}

/** Immutable, verified SEP-10 challenge state. */
export class Sep10Challenge {
  readonly #verified: VerifiedSep10Challenge;
  readonly #networkPassphrase: string;

  /** @internal Creates an immutable state from verified data. */
  constructor(
    verified: VerifiedSep10Challenge,
    networkPassphrase: string,
  ) {
    this.#verified = verified;
    this.#networkPassphrase = networkPassphrase;
  }

  /** Requested account bound to this challenge. */
  get account(): string {
    return this.#verified.account;
  }

  /** Requested memo bound to this challenge. */
  get memo(): string | undefined {
    return this.#verified.memo;
  }

  /** Accepted client domain, when the server included it. */
  get clientDomain(): string | undefined {
    return this.#verified.clientDomain;
  }

  /** Accepted client-domain signing key. */
  get clientDomainAccount(): string | undefined {
    return this.#verified.clientDomainAccount;
  }

  /** Inclusive challenge time bounds. */
  get timeBounds(): Readonly<{ minTime: Date; maxTime: Date }> {
    return {
      minTime: new Date(this.#verified.minTime * 1_000),
      maxTime: new Date(this.#verified.maxTime * 1_000),
    };
  }

  /** Defensive transaction clone. */
  get transaction(): Transaction {
    return cloneTransaction(
      this.#verified.transactionXdr,
      this.#networkPassphrase,
    );
  }

  /** Original verified transaction-envelope XDR. */
  toXDR(): string {
    return this.#verified.transactionXdr;
  }

  /** @internal Network passphrase retained for immutable transitions. */
  get networkPassphrase(): string {
    return this.#networkPassphrase;
  }

  /** @internal Verified context retained for token binding. */
  get verified(): VerifiedSep10Challenge {
    return { ...this.#verified, transaction: this.transaction };
  }
}

/** Immutable SEP-10 challenge carrying client signatures. */
export class Sep10SignedChallenge {
  readonly #transactionXdr: string;
  readonly #verified: VerifiedSep10Challenge;
  readonly #networkPassphrase: string;

  /** @internal Creates a signed state. */
  constructor(
    transactionXdr: string,
    verified: VerifiedSep10Challenge,
    networkPassphrase: string,
  ) {
    this.#transactionXdr = transactionXdr;
    this.#verified = verified;
    this.#networkPassphrase = networkPassphrase;
  }

  /** Defensive signed transaction clone. */
  get transaction(): Transaction {
    return cloneTransaction(this.#transactionXdr, this.#networkPassphrase);
  }

  /** Signed transaction-envelope XDR. */
  toXDR(): string {
    return this.#transactionXdr;
  }

  /** @internal Verified context retained for token binding. */
  get verified(): VerifiedSep10Challenge {
    return {
      ...this.#verified,
      transaction: cloneTransaction(
        this.#verified.transactionXdr,
        this.#networkPassphrase,
      ),
    };
  }
}
