/**
 * Minimal binary payload used by Colibri's public byte-oriented APIs.
 *
 * This intentionally accepts structural JavaScript byte containers instead of
 * exposing a specific `buffer` package version as part of Colibri's public API.
 */
export type BinaryData = ArrayBuffer | ArrayBufferView;

/**
 * Minimal XDR-serializable surface exposed by low-level Colibri APIs.
 */
export interface XdrSerializable {
  /**
   * Serializes the value into an XDR string representation.
   *
   * @param format - Desired XDR output format.
   * @returns Encoded XDR payload.
   */
  toXDR(format?: "raw" | "hex" | "base64"): string | Uint8Array;
}

/**
 * Ledger key shape returned by low-level ledger lookup helpers.
 */
export interface LedgerKeyLike extends XdrSerializable {
  /**
   * Returns the active XDR union arm for the ledger key.
   */
  switch(): { name: string; value: number };

  /**
   * Returns the account arm when this key targets an account entry.
   */
  account(): { accountId(): XdrSerializable } | undefined;

  /**
   * Returns the trustline arm when this key targets a trustline entry.
   */
  trustLine(): { accountId(): XdrSerializable } | undefined;
}

/**
 * Asset surface required to derive a trustline ledger key.
 */
export interface TrustlineAssetLike {
  /**
   * Converts the asset into the XDR payload expected by Stellar trustlines.
   *
   * @returns SDK-compatible trustline asset payload.
   */
  toTrustLineXDRObject(): unknown;
}

/**
 * Minimal transaction envelope surface accepted by signer helpers.
 */
export interface SignableTransaction extends XdrSerializable {
  /**
   * Applies one or more signatures to the transaction envelope.
   *
   * @param signers - Signer objects understood by the underlying transaction.
   */
  sign(...signers: unknown[]): unknown;
}

/**
 * Minimal Soroban authorization entry surface accepted by signer helpers.
 */
export interface SorobanAuthorizationEntryLike extends XdrSerializable {
  /**
   * Returns the authorization credentials union.
   */
  credentials(): unknown;

  /**
   * Returns the root invocation attached to the authorization entry.
   */
  rootInvocation(): unknown;
}

/**
 * Minimal ScVal surface used by Colibri's raw XDR-facing APIs.
 */
export interface ScValLike extends XdrSerializable {}

/**
 * Minimal RPC event filter payload accepted by Stellar RPC endpoints.
 */
export interface RpcEventFilterLike {
  /**
   * Optional event type discriminator.
   */
  type?: "contract" | "system";

  /**
   * Optional list of contract ids to match.
   */
  contractIds?: string[];

  /**
   * Optional encoded topic filters.
   */
  topics?: string[][];
}

/**
 * Minimal contract address surface returned by Stellar RPC event payloads.
 */
export interface ContractAddressLike {
  /**
   * Returns the contract id encoded by the address wrapper.
   */
  contractId(): string;
}

/**
 * Minimal RPC event payload consumed by Colibri's event helpers.
 */
export interface RpcEventResponseLike {
  /**
   * Event identifier in `ledger-tx-op-event` form.
   */
  id: string;

  /**
   * Event category returned by RPC.
   */
  type: string;

  /**
   * Ledger sequence that emitted the event.
   */
  ledger: number;

  /**
   * Ledger close timestamp as returned by RPC.
   */
  ledgerClosedAt: string;

  /**
   * Index of the transaction within the ledger.
   */
  transactionIndex: number;

  /**
   * Index of the operation within the transaction.
   */
  operationIndex: number;

  /**
   * Whether the event originated from a successful contract invocation.
   */
  inSuccessfulContractCall: boolean;

  /**
   * Transaction hash associated with the event.
   */
  txHash: string;

  /**
   * Optional wrapped contract id.
   */
  contractId?: ContractAddressLike;

  /**
   * Raw topic segments emitted by the event.
   */
  topic: ScValLike[];

  /**
   * Raw event payload.
   */
  value: ScValLike;
}
