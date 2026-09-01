import type { ExternalExecutableRef } from "stellar-sdk";

/** A contract Wasm supplied directly or resolved from a Stellar network. */
export type VerificationTarget =
  | { readonly wasm: Uint8Array; readonly label?: string }
  | { readonly wasmHash: string; readonly label?: string }
  | { readonly contractId: string; readonly label?: string }
  | { readonly externalRef: ExternalExecutableRef; readonly label?: string };

/** One ledger-entry observation retained for an external reference. */
export type VerificationLedgerObservationEvidence = {
  readonly observedAtLedger: number;
  readonly lastModifiedLedgerSeq?: number;
};

/** Serializable CAP-85 owner/tag resolution facts. */
export type VerificationExternalReferenceEvidence = {
  readonly executableOwner: string;
  readonly tag: {
    readonly encoding: "base64";
    readonly value: string;
  };
  readonly instance?: VerificationLedgerObservationEvidence;
  readonly reference: VerificationLedgerObservationEvidence;
};

/** Exact target facts returned by a verification-target resolver. */
export type ResolvedVerificationTarget =
  | {
    readonly applicability: "wasm";
    readonly kind: "wasm" | "wasmHash" | "contractId" | "externalRef";
    readonly label?: string;
    readonly contractId?: string;
    readonly wasm: Uint8Array;
    readonly wasmHash: string;
    readonly externalReference?: VerificationExternalReferenceEvidence;
    readonly lastModifiedLedgerSeq?: number;
    readonly observedAt: string;
  }
  | {
    readonly applicability: "stellarAssetContract";
    readonly kind: "contractId";
    readonly label?: string;
    readonly contractId: string;
    readonly lastModifiedLedgerSeq?: number;
    readonly observedAt: string;
  };

/** Serializable target facts retained in verification evidence. */
export type VerificationTargetEvidence = {
  readonly kind: "wasm" | "wasmHash" | "contractId" | "externalRef";
  readonly label?: string;
  readonly contractId?: string;
  readonly wasmHash?: string;
  readonly wasmLength?: number;
  readonly externalReference?: VerificationExternalReferenceEvidence;
  readonly lastModifiedLedgerSeq?: number;
  readonly observedAt: string;
};
