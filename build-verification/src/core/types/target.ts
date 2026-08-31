/** A contract Wasm supplied directly or resolved from a Stellar network. */
export type VerificationTarget =
  | { readonly wasm: Uint8Array; readonly label?: string }
  | { readonly wasmHash: string; readonly label?: string }
  | { readonly contractId: string; readonly label?: string };

/** Exact target facts returned by a verification-target resolver. */
export type ResolvedVerificationTarget =
  | {
    readonly applicability: "wasm";
    readonly kind: "wasm" | "wasmHash" | "contractId";
    readonly label?: string;
    readonly contractId?: string;
    readonly wasm: Uint8Array;
    readonly wasmHash: string;
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
  readonly kind: "wasm" | "wasmHash" | "contractId";
  readonly label?: string;
  readonly contractId?: string;
  readonly wasmHash?: string;
  readonly wasmLength?: number;
  readonly lastModifiedLedgerSeq?: number;
  readonly observedAt: string;
};
