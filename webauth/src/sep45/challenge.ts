import { xdr } from "stellar-sdk";
import {
  decodeSep45AuthorizationEntries,
  encodeSep45AuthorizationEntries,
} from "@/sep45/codec.ts";
import type {
  Sep45SimulationReceipt,
  VerifiedSep45Challenge,
} from "@/sep45/types.ts";
import type { SorobanAuthorizationEntry } from "@/stellar-sdk-types.ts";

function cloneVerified(
  verified: VerifiedSep45Challenge,
): VerifiedSep45Challenge {
  const entries = decodeSep45AuthorizationEntries(
    verified.authorizationEntriesXdr,
  );
  return {
    ...verified,
    entries,
    invocationArgument: xdr.ScVal.fromXdr(
      verified.invocationArgument.toXdr(),
    ),
    arguments: Object.freeze({ ...verified.arguments }),
    extensionArguments: Object.freeze({ ...verified.extensionArguments }),
  };
}

/** Immutable, structurally and cryptographically verified SEP-45 challenge. */
export class Sep45Challenge {
  readonly #verified: VerifiedSep45Challenge;

  /** @internal Creates a state from pure verification output. */
  constructor(verified: VerifiedSep45Challenge) {
    this.#verified = cloneVerified(verified);
  }

  /** Contract account requested for authentication. */
  get account(): string {
    return this.#verified.account;
  }

  /** Complete SEP-45 argument map, including extensions. */
  get arguments(): Readonly<Record<string, string>> {
    return { ...this.#verified.arguments };
  }

  /** Unknown Symbol-to-String arguments preserved by Colibri. */
  get extensionArguments(): Readonly<Record<string, string>> {
    return { ...this.#verified.extensionArguments };
  }

  /** Accepted client domain, when present. */
  get clientDomain(): string | undefined {
    return this.#verified.clientDomain;
  }

  /** Verified authorization-entry array XDR. */
  toXdr(): string {
    return this.#verified.authorizationEntriesXdr;
  }

  /** Defensive clones of the verified entries. */
  get entries(): SorobanAuthorizationEntry[] {
    return decodeSep45AuthorizationEntries(this.toXdr());
  }

  /** @internal Verified context retained for lifecycle transitions. */
  get verified(): VerifiedSep45Challenge {
    return cloneVerified(this.#verified);
  }
}

/** Immutable SEP-45 challenge after application authorization. */
export class Sep45AuthorizedChallenge {
  readonly #verified: VerifiedSep45Challenge;
  readonly #authorizationEntriesXdr: string;
  readonly #validUntilLedgerSeq: number;

  /** @internal Creates an authorized state. */
  constructor(
    verified: VerifiedSep45Challenge,
    entries: SorobanAuthorizationEntry[],
    validUntilLedgerSeq: number,
  ) {
    this.#verified = cloneVerified(verified);
    this.#authorizationEntriesXdr = encodeSep45AuthorizationEntries(entries);
    this.#validUntilLedgerSeq = validUntilLedgerSeq;
  }

  /** Client-controlled expiration selected before authorization. */
  get validUntilLedgerSeq(): number {
    return this.#validUntilLedgerSeq;
  }

  /** Authorized entry array XDR. */
  toXdr(): string {
    return this.#authorizationEntriesXdr;
  }

  /** Defensive clones of every authorized and preserved entry. */
  get entries(): SorobanAuthorizationEntry[] {
    return decodeSep45AuthorizationEntries(this.toXdr());
  }

  /** @internal Verified pre-authorization context. */
  get verified(): VerifiedSep45Challenge {
    return cloneVerified(this.#verified);
  }
}

/** Immutable SEP-45 challenge that passed enforcing simulation. */
export class Sep45PreparedChallenge {
  readonly #authorized: Sep45AuthorizedChallenge;
  readonly #receipt: Sep45SimulationReceipt;

  /** @internal Creates a prepared state with its simulation receipt. */
  constructor(
    authorized: Sep45AuthorizedChallenge,
    receipt: Sep45SimulationReceipt,
  ) {
    this.#authorized = authorized;
    this.#receipt = Object.freeze({
      ...receipt,
      readOnlyFootprint: [...receipt.readOnlyFootprint],
      readWriteFootprint: [...receipt.readWriteFootprint],
    });
  }

  /** Authorized entry array XDR accepted by enforcing simulation. */
  toXdr(): string {
    return this.#authorized.toXdr();
  }

  /** Defensive simulation receipt. */
  get simulation(): Sep45SimulationReceipt {
    return {
      ...this.#receipt,
      readOnlyFootprint: [...this.#receipt.readOnlyFootprint],
      readWriteFootprint: [...this.#receipt.readWriteFootprint],
    };
  }

  /** @internal Authorized state retained for token context. */
  get authorized(): Sep45AuthorizedChallenge {
    return this.#authorized;
  }
}
