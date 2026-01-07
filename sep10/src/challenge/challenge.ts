/**
 * SEP-10 Challenge
 *
 * Parses, validates, and manages SEP-10 challenge transactions.
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
 */

import {
  type Transaction,
  TransactionBuilder,
  Keypair,
  Operation,
  Memo,
  xdr,
  Account,
} from "stellar-sdk";
import { Buffer } from "buffer";
import { isSigner } from "@colibri/core";
import type { Signer } from "@colibri/core";
import type {
  BuildChallengeOptions,
  VerifyChallengeOptions,
  ChallengeOperation,
  ChallengeTimeBounds,
} from "@/types.ts";
import * as E from "@/challenge/error.ts";
import { isChallengeTransaction as _isChallengeTransaction } from "@/utils/is-challenge-transaction.ts";
import { isChallengeXDR as _isChallengeXDR } from "@/utils/is-challenge-xdr.ts";

/** Suffix for the home domain auth key */
const AUTH_KEY_SUFFIX = " auth";

/** Expected nonce length (48 random bytes base64 encoded = 64 bytes) */
const EXPECTED_NONCE_LENGTH = 64;

/** Default challenge timeout in seconds (15 minutes) */
const DEFAULT_TIMEOUT = 900;

/**
 * SEP10Challenge - Parse, verify, and sign SEP-10 challenge transactions.
 *
 * This class handles the client-side of SEP-10 Web Authentication by:
 * - Parsing challenge transactions from XDR
 * - Validating challenge structure and signatures
 * - Signing challenges with client keys
 * - Exporting signed challenges back to XDR
 *
 * @example
 * ```typescript
 * // Parse a challenge from XDR
 * const challenge = SEP10Challenge.fromXDR(xdrString, Networks.TESTNET);
 *
 * // Verify the challenge
 * challenge.verify(serverPublicKey, { homeDomain: "example.com" });
 *
 * // Sign and export
 * challenge.sign(clientKeypair);
 * const signedXDR = challenge.toXDR();
 * ```
 */
export class SEP10Challenge {
  private readonly _transaction: Transaction;
  private readonly _networkPassphrase: string;
  private readonly _serverAccount: string;
  private readonly _clientAccount: string;
  private readonly _homeDomain: string;
  private readonly _nonce: Buffer;
  private readonly _webAuthDomain?: string;
  private readonly _clientDomain?: string;
  private readonly _clientDomainAccount?: string;
  private readonly _memo?: string;
  private readonly _timeBounds: ChallengeTimeBounds;
  private readonly _operations: ChallengeOperation[];

  private constructor(
    transaction: Transaction,
    networkPassphrase: string,
    parsed: {
      serverAccount: string;
      clientAccount: string;
      homeDomain: string;
      nonce: Buffer;
      webAuthDomain?: string;
      clientDomain?: string;
      clientDomainAccount?: string;
      memo?: string;
      timeBounds: ChallengeTimeBounds;
      operations: ChallengeOperation[];
    }
  ) {
    this._transaction = transaction;
    this._networkPassphrase = networkPassphrase;
    this._serverAccount = parsed.serverAccount;
    this._clientAccount = parsed.clientAccount;
    this._homeDomain = parsed.homeDomain;
    this._nonce = parsed.nonce;
    this._webAuthDomain = parsed.webAuthDomain;
    this._clientDomain = parsed.clientDomain;
    this._clientDomainAccount = parsed.clientDomainAccount;
    this._memo = parsed.memo;
    this._timeBounds = parsed.timeBounds;
    this._operations = parsed.operations;
  }

  // ===========================================================================
  // Factory Methods
  // ===========================================================================

  /**
   * Creates a SEP10Challenge from an XDR-encoded transaction envelope.
   *
   * @param xdr - Base64-encoded transaction envelope XDR
   * @param networkPassphrase - The Stellar network passphrase
   * @returns A SEP10Challenge instance
   * @throws {INVALID_XDR} If the XDR cannot be decoded
   * @throws {INVALID_SEQUENCE} If sequence number is not 0
   * @throws {MISSING_TIME_BOUNDS} If time bounds are not set
   * @throws {NO_OPERATIONS} If there are no operations
   * @throws {INVALID_FIRST_OPERATION} If first op is not ManageData
   *
   * @example
   * ```typescript
   * const challenge = SEP10Challenge.fromXDR(
   *   xdrString,
   *   Networks.TESTNET
   * );
   * ```
   */
  static fromXDR(xdr: string, networkPassphrase: string): SEP10Challenge {
    let transaction: Transaction;

    try {
      transaction = TransactionBuilder.fromXDR(
        xdr,
        networkPassphrase
      ) as Transaction;
    } catch (error) {
      throw new E.INVALID_XDR(error as Error, xdr);
    }

    return SEP10Challenge.fromTransaction(transaction, networkPassphrase);
  }

  /**
   * Creates a SEP10Challenge from a Transaction object.
   *
   * @param transaction - A Stellar Transaction object
   * @param networkPassphrase - The Stellar network passphrase
   * @returns A SEP10Challenge instance
   * @throws {INVALID_SEQUENCE} If sequence number is not 0
   * @throws {MISSING_TIME_BOUNDS} If time bounds are not set
   * @throws {NO_OPERATIONS} If there are no operations
   * @throws {INVALID_FIRST_OPERATION} If first op is not ManageData
   *
   * @example
   * ```typescript
   * const challenge = SEP10Challenge.fromTransaction(tx, Networks.TESTNET);
   * ```
   */
  static fromTransaction(
    transaction: Transaction,
    networkPassphrase: string
  ): SEP10Challenge {
    // Validate sequence number
    if (transaction.sequence !== "0") {
      throw new E.INVALID_SEQUENCE(transaction.sequence);
    }

    // Validate time bounds
    if (!transaction.timeBounds) {
      throw new E.MISSING_TIME_BOUNDS();
    }

    const timeBounds: ChallengeTimeBounds = {
      minTime: new Date(parseInt(transaction.timeBounds.minTime, 10) * 1000),
      maxTime: new Date(parseInt(transaction.timeBounds.maxTime, 10) * 1000),
    };

    // Validate operations exist
    if (transaction.operations.length === 0) {
      throw new E.NO_OPERATIONS();
    }

    // Validate first operation is ManageData
    const firstOp = transaction.operations[0];
    if (firstOp.type !== "manageData") {
      throw new E.INVALID_FIRST_OPERATION(firstOp.type);
    }

    // Extract client account from first operation
    if (!firstOp.source) {
      throw new E.CLIENT_ACCOUNT_MISMATCH("undefined");
    }
    const clientAccount = firstOp.source;

    // Extract home domain from first operation key
    const firstOpKey = firstOp.name;
    if (!firstOpKey.endsWith(AUTH_KEY_SUFFIX)) {
      throw new E.INVALID_HOME_DOMAIN(firstOpKey);
    }
    const homeDomain = firstOpKey.slice(0, -AUTH_KEY_SUFFIX.length);

    // Extract nonce from first operation value
    const nonceValue = firstOp.value;
    if (!nonceValue || nonceValue.length !== EXPECTED_NONCE_LENGTH) {
      throw new E.INVALID_NONCE(nonceValue?.length ?? 0);
    }
    const nonce = Buffer.from(nonceValue);

    // Parse all operations
    const operations: ChallengeOperation[] = [];
    let webAuthDomain: string | undefined;
    let clientDomain: string | undefined;
    let clientDomainAccount: string | undefined;

    for (const op of transaction.operations) {
      if (op.type !== "manageData") {
        continue; // Skip non-ManageData ops (shouldn't happen in valid challenge)
      }

      const manageDataOp = op as Operation.ManageData;
      operations.push({
        type: "manageData",
        sourceAccount: manageDataOp.source || transaction.source,
        key: manageDataOp.name,
        value: Buffer.from(manageDataOp.value || ""),
      });

      // Extract web_auth_domain
      if (manageDataOp.name === "web_auth_domain" && manageDataOp.value) {
        webAuthDomain = manageDataOp.value.toString();
      }

      // Extract client_domain
      if (manageDataOp.name === "client_domain" && manageDataOp.value) {
        clientDomain = manageDataOp.value.toString();
        clientDomainAccount = manageDataOp.source;
      }
    }

    // Extract memo if present
    let memo: string | undefined;
    if (transaction.memo.type !== "none") {
      if (transaction.memo.type !== "id") {
        throw new E.INVALID_MEMO_TYPE(transaction.memo.type);
      }
      memo = String(transaction.memo.value);

      // Check muxed account with memo
      if (clientAccount.startsWith("M")) {
        throw new E.MUXED_ACCOUNT_WITH_MEMO(clientAccount, memo);
      }
    }

    // Server account is the transaction source
    const serverAccount = transaction.source;

    return new SEP10Challenge(transaction, networkPassphrase, {
      serverAccount,
      clientAccount,
      homeDomain,
      nonce,
      webAuthDomain,
      clientDomain,
      clientDomainAccount,
      memo,
      timeBounds,
      operations,
    });
  }

  /**
   * Builds a new SEP-10 challenge transaction.
   * Primarily used for server-side challenge generation or testing.
   *
   * @param options - Build options
   * @returns A SEP10Challenge instance
   *
   * @example
   * ```typescript
   * const challenge = SEP10Challenge.build({
   *   serverAccount: "GSERVER...",
   *   clientAccount: "GCLIENT...",
   *   homeDomain: "example.com",
   *   networkPassphrase: Networks.TESTNET,
   *   webAuthDomain: "auth.example.com",
   * });
   * ```
   */
  static build(options: BuildChallengeOptions): SEP10Challenge {
    const {
      serverAccount,
      clientAccount,
      homeDomain,
      networkPassphrase,
      webAuthDomain,
      clientDomain,
      clientDomainAccount,
      memo,
      timeout = DEFAULT_TIMEOUT,
      nonce,
    } = options;

    // Generate random nonce if not provided (48 bytes -> 64 bytes base64)
    const nonceBuffer = nonce || crypto.getRandomValues(new Uint8Array(48));
    const nonceBase64 = Buffer.from(nonceBuffer).toString("base64");

    const now = Math.floor(Date.now() / 1000);

    // Build transaction
    const builder = new TransactionBuilder(new Account(serverAccount, "-1"), {
      fee: "100",
      networkPassphrase,
      timebounds: {
        minTime: now,
        maxTime: now + timeout,
      },
    });

    // Add memo if provided
    if (memo) {
      if (clientAccount.startsWith("M")) {
        throw new E.MUXED_ACCOUNT_WITH_MEMO(clientAccount, memo);
      }
      builder.addMemo(Memo.id(memo));
    }

    // First operation: client auth
    builder.addOperation(
      Operation.manageData({
        source: clientAccount,
        name: `${homeDomain}${AUTH_KEY_SUFFIX}`,
        value: nonceBase64,
      })
    );

    // web_auth_domain operation
    if (webAuthDomain) {
      builder.addOperation(
        Operation.manageData({
          source: serverAccount,
          name: "web_auth_domain",
          value: webAuthDomain,
        })
      );
    }

    // client_domain operation
    if (clientDomain && clientDomainAccount) {
      builder.addOperation(
        Operation.manageData({
          source: clientDomainAccount,
          name: "client_domain",
          value: clientDomain,
        })
      );
    }

    // Build transaction (timebounds already set in options)
    const transaction = builder.build();

    return SEP10Challenge.fromTransaction(transaction, networkPassphrase);
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /** The underlying Stellar transaction */
  get transaction(): Transaction {
    return this._transaction;
  }

  /** The network passphrase used */
  get networkPassphrase(): string {
    return this._networkPassphrase;
  }

  /** The server's account (transaction source) */
  get serverAccount(): string {
    return this._serverAccount;
  }

  /** The client's account (first operation source) */
  get clientAccount(): string {
    return this._clientAccount;
  }

  /** The home domain extracted from the first operation key */
  get homeDomain(): string {
    return this._homeDomain;
  }

  /** The nonce value from the first operation */
  get nonce(): Buffer {
    return Buffer.from(this._nonce);
  }

  /** The web auth domain if present */
  get webAuthDomain(): string | undefined {
    return this._webAuthDomain;
  }

  /** The client domain if present */
  get clientDomain(): string | undefined {
    return this._clientDomain;
  }

  /** The client domain account if client_domain operation is present */
  get clientDomainAccount(): string | undefined {
    return this._clientDomainAccount;
  }

  /** The memo if present (as string) */
  get memo(): string | undefined {
    return this._memo;
  }

  /** The time bounds */
  get timeBounds(): ChallengeTimeBounds {
    return {
      minTime: new Date(this._timeBounds.minTime.getTime()),
      maxTime: new Date(this._timeBounds.maxTime.getTime()),
    };
  }

  /** Whether the challenge has expired */
  get isExpired(): boolean {
    return new Date() > this._timeBounds.maxTime;
  }

  /** All ManageData operations in the challenge */
  get operations(): ChallengeOperation[] {
    return this._operations.map((op) => ({
      ...op,
      value: Buffer.from(op.value),
    }));
  }

  /** The transaction signatures */
  get signatures(): readonly xdr.DecoratedSignature[] {
    return [...this._transaction.signatures];
  }

  // ===========================================================================
  // Validation
  // ===========================================================================

  /**
   * Default time tolerance in seconds for time bounds validation.
   * Safely covers typical NTP drift while being negligible compared
   * to the standard 15-minute challenge validity window.
   */
  static readonly DEFAULT_TIME_TOLERANCE = 5;

  /**
   * Verifies the challenge transaction time bounds.
   *
   * @param options - Time bounds verification options
   * @throws {CHALLENGE_EXPIRED} If the challenge is outside time bounds
   *
   * @example
   * ```typescript
   * challenge.verifyTimeBounds(); // uses current time with default 5s tolerance
   * challenge.verifyTimeBounds({ now: new Date(), allowExpired: true });
   * challenge.verifyTimeBounds({ timeTolerance: 10 }); // 10 second tolerance
   * challenge.verifyTimeBounds({ skipTimeValidation: true }); // skip validation
   * ```
   */
  verifyTimeBounds(
    options: Pick<
      VerifyChallengeOptions,
      "allowExpired" | "now" | "timeTolerance" | "skipTimeValidation"
    > = {}
  ): void {
    const {
      allowExpired = false,
      now = new Date(),
      timeTolerance = SEP10Challenge.DEFAULT_TIME_TOLERANCE,
      skipTimeValidation = false,
    } = options;

    // Skip all time validation if requested (for testing scenarios)
    if (skipTimeValidation || allowExpired) {
      return;
    }

    const nowSeconds = Math.floor(now.getTime() / 1000);
    const minTime = Math.floor(this._timeBounds.minTime.getTime() / 1000);
    const maxTime = Math.floor(this._timeBounds.maxTime.getTime() / 1000);

    // Apply tolerance in both directions:
    // - Accept challenges whose minTime is up to N seconds in the future (client clock behind)
    // - Accept challenges whose maxTime was up to N seconds ago (client clock ahead)
    const adjustedMinTime = minTime - timeTolerance;
    const adjustedMaxTime = maxTime + timeTolerance;

    if (nowSeconds < adjustedMinTime || nowSeconds > adjustedMaxTime) {
      throw new E.CHALLENGE_EXPIRED(minTime, maxTime, nowSeconds);
    }
  }

  /**
   * Verifies the server's signature on the challenge.
   *
   * @param serverPublicKey - The server's public key
   * @throws {INVALID_SERVER_SIGNATURE} If server signature is missing or invalid
   *
   * @example
   * ```typescript
   * challenge.verifyServerSignature(serverPublicKey);
   * ```
   */
  verifyServerSignature(serverPublicKey: string): void {
    const serverKeypair = Keypair.fromPublicKey(serverPublicKey);
    const txHash = this._transaction.hash();

    for (const sig of this._transaction.signatures) {
      if (serverKeypair.verify(txHash, sig.signature())) {
        return; // Valid signature found
      }
    }

    throw new E.INVALID_SERVER_SIGNATURE(serverPublicKey);
  }

  /**
   * Verifies the challenge home domain matches the expected value.
   *
   * @param expectedHomeDomain - The expected home domain
   * @throws {INVALID_HOME_DOMAIN} If home domain doesn't match
   *
   * @example
   * ```typescript
   * challenge.verifyHomeDomain("example.com");
   * ```
   */
  verifyHomeDomain(expectedHomeDomain: string): void {
    if (this._homeDomain !== expectedHomeDomain) {
      throw new E.INVALID_HOME_DOMAIN(this._homeDomain, expectedHomeDomain);
    }
  }

  /**
   * Verifies the web_auth_domain operation.
   *
   * @param serverPublicKey - The server's public key (to verify source)
   * @param expectedWebAuthDomain - Optional expected web auth domain value
   * @throws {INVALID_WEB_AUTH_DOMAIN} If web_auth_domain doesn't match or has wrong source
   *
   * @example
   * ```typescript
   * challenge.verifyWebAuthDomain(serverPublicKey);
   * challenge.verifyWebAuthDomain(serverPublicKey, "auth.example.com");
   * ```
   */
  verifyWebAuthDomain(
    serverPublicKey: string,
    expectedWebAuthDomain?: string
  ): void {
    // Verify value matches if expected is provided
    if (
      expectedWebAuthDomain &&
      this._webAuthDomain !== expectedWebAuthDomain
    ) {
      throw new E.INVALID_WEB_AUTH_DOMAIN({
        expected: expectedWebAuthDomain,
        actual: this._webAuthDomain,
      });
    }

    // Verify source account is server
    if (this._webAuthDomain) {
      const webAuthOp = this._operations.find(
        (op) => op.key === "web_auth_domain"
      );
      if (webAuthOp && webAuthOp.sourceAccount !== serverPublicKey) {
        throw new E.INVALID_WEB_AUTH_DOMAIN({
          sourceAccount: webAuthOp.sourceAccount,
        });
      }
    }
  }

  /**
   * Verifies that all operations have correct source accounts.
   * - First operation source = client account (already validated at parse time)
   * - web_auth_domain source = server account
   * - client_domain source = client domain account (skipped, third-party)
   * - All other operations source = server account
   *
   * @param serverPublicKey - The server's public key
   * @throws {INVALID_OPERATION_SOURCE} If any operation has incorrect source
   *
   * @example
   * ```typescript
   * challenge.verifyOperationSources(serverPublicKey);
   * ```
   */
  verifyOperationSources(serverPublicKey: string): void {
    for (let i = 1; i < this._operations.length; i++) {
      const op = this._operations[i];

      // client_domain is signed by third-party, skip
      if (op.key === "client_domain") {
        continue;
      }

      // web_auth_domain is checked separately
      if (op.key === "web_auth_domain") {
        continue;
      }

      // All other operations must be from server
      if (op.sourceAccount !== serverPublicKey) {
        throw new E.INVALID_OPERATION_SOURCE(
          op.key,
          op.sourceAccount,
          serverPublicKey
        );
      }
    }
  }

  /**
   * Verifies the challenge transaction by running all validation checks.
   *
   * @param serverPublicKey - The server's public key to verify signature against
   * @param options - Verification options
   * @throws {CHALLENGE_EXPIRED} If the challenge has expired
   * @throws {INVALID_SERVER_SIGNATURE} If server signature is invalid
   * @throws {INVALID_HOME_DOMAIN} If home domain doesn't match expected
   * @throws {INVALID_WEB_AUTH_DOMAIN} If web_auth_domain doesn't match expected
   * @throws {INVALID_OPERATION_SOURCE} If any operation has incorrect source
   *
   * @example
   * ```typescript
   * challenge.verify(serverPublicKey, {
   *   homeDomain: "example.com",
   *   webAuthDomain: "auth.example.com",
   * });
   * ```
   */
  verify(serverPublicKey: string, options: VerifyChallengeOptions = {}): void {
    const {
      homeDomain,
      webAuthDomain,
      allowExpired,
      now,
      timeTolerance,
      skipTimeValidation,
    } = options;

    // 1. Check time bounds
    this.verifyTimeBounds({
      allowExpired,
      now,
      timeTolerance,
      skipTimeValidation,
    });

    // 2. Verify server signature
    this.verifyServerSignature(serverPublicKey);

    // 3. Verify home domain if specified
    if (homeDomain) {
      this.verifyHomeDomain(homeDomain);
    }

    // 4. Verify web_auth_domain
    this.verifyWebAuthDomain(serverPublicKey, webAuthDomain);

    // 5. Verify operation sources
    this.verifyOperationSources(serverPublicKey);
  }

  /**
   * Checks if the challenge is valid without throwing.
   *
   * @param serverPublicKey - The server's public key to verify signature against
   * @param options - Verification options
   * @returns true if valid, false otherwise
   */
  isValid(
    serverPublicKey: string,
    options: VerifyChallengeOptions = {}
  ): boolean {
    try {
      this.verify(serverPublicKey, options);
      return true;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Signing
  // ===========================================================================

  /**
   * Signs the challenge with a keypair or Signer.
   *
   * @param signer - The Keypair or Signer to sign with
   * @returns this (for chaining)
   *
   * @example
   * ```typescript
   * // With Keypair
   * challenge.sign(clientKeypair);
   *
   * // With Signer from colibri core
   * challenge.sign(mySigner);
   *
   * // Chaining
   * challenge
   *   .sign(clientKeypair)
   *   .sign(clientDomainSigner);
   * ```
   */
  sign(signer: Keypair | Signer): this {
    if (isSigner(signer)) {
      const signature = signer.sign(Buffer.from(this._transaction.hash()));
      const hint = Keypair.fromPublicKey(signer.publicKey()).signatureHint();
      this._transaction.signatures.push(
        new xdr.DecoratedSignature({ hint, signature })
      );
    } else {
      this._transaction.sign(signer);
    }
    return this;
  }

  /**
   * Adds a pre-computed signature to the transaction.
   *
   * @param signature - The decorated signature to add
   * @returns this (for chaining)
   */
  addSignature(signature: xdr.DecoratedSignature): this {
    this._transaction.signatures.push(signature);
    return this;
  }

  // ===========================================================================
  // Export
  // ===========================================================================

  /**
   * Exports the challenge transaction to XDR.
   *
   * @returns Base64-encoded transaction envelope XDR
   */
  toXDR(): string {
    return this._transaction.toXDR();
  }

  /**
   * Returns a JSON-serializable representation of the challenge.
   */
  toJSON(): Record<string, unknown> {
    return {
      serverAccount: this._serverAccount,
      clientAccount: this._clientAccount,
      homeDomain: this._homeDomain,
      webAuthDomain: this._webAuthDomain,
      clientDomain: this._clientDomain,
      clientDomainAccount: this._clientDomainAccount,
      memo: this._memo,
      timeBounds: {
        minTime: this._timeBounds.minTime.toISOString(),
        maxTime: this._timeBounds.maxTime.toISOString(),
      },
      isExpired: this.isExpired,
      signatureCount: this._transaction.signatures.length,
    };
  }

  // ===========================================================================
  // Static Utilities
  // ===========================================================================

  /**
   * Checks if a Transaction object has the structure of a SEP-10 challenge.
   * This performs structural validation only (no signature verification).
   *
   * @param transaction - The Transaction object to check
   * @returns true if the transaction has challenge structure, false otherwise
   *
   * @example
   * ```typescript
   * if (SEP10Challenge.isChallengeTransaction(tx)) {
   *   const challenge = SEP10Challenge.fromTransaction(tx, networkPassphrase);
   * }
   * ```
   */
  static isChallengeTransaction(transaction: Transaction): boolean {
    return _isChallengeTransaction(transaction);
  }

  /**
   * Checks if an XDR string can be parsed as a SEP-10 challenge.
   * This attempts to decode the XDR and validate the challenge structure.
   * Does not verify signatures.
   *
   * @param xdr - Base64-encoded transaction envelope XDR
   * @param networkPassphrase - The Stellar network passphrase
   * @returns true if the XDR is a valid challenge structure, false otherwise
   *
   * @example
   * ```typescript
   * if (SEP10Challenge.isChallengeXDR(xdrString, Networks.TESTNET)) {
   *   const challenge = SEP10Challenge.fromXDR(xdrString, Networks.TESTNET);
   * }
   * ```
   */
  static isChallengeXDR(xdr: string, networkPassphrase: string): boolean {
    return _isChallengeXDR(xdr, networkPassphrase);
  }
}
