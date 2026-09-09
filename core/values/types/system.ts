// Reading these owned readonly static fields has no side effects.
// Pure wrappers let bundlers discard aliases that the consumer does not use.
import {
  SorobanContractInstance,
  SorobanExecutableTag,
  SorobanLedgerKeyContractInstance,
  SorobanLedgerKeyNonce,
} from "@/values/system.ts";
import type { SorobanTypeOutput } from "@/values/containers.ts";

/** Complete contract-instance payload, for ledger inspection. */
export type ContractInstance = SorobanTypeOutput<
  typeof SorobanContractInstance.type
>;
/** Lossless contract-instance codec; rejected as an ordinary contract argument. */
export const ContractInstance: typeof SorobanContractInstance.type =
  /* @__PURE__ */ (() => SorobanContractInstance.type)();
/** Payload-free reserved instance key. */
export type LedgerKeyContractInstance = null;
/** Codec for the reserved instance ledger key. */
export const LedgerKeyContractInstance:
  typeof SorobanLedgerKeyContractInstance.type =
    /* @__PURE__ */ (() => SorobanLedgerKeyContractInstance.type)();
/** Signed 64-bit nonce used by the reserved nonce key. */
export type LedgerKeyNonce = bigint;
/** Codec for the reserved nonce ledger key. */
export const LedgerKeyNonce: typeof SorobanLedgerKeyNonce.type =
  /* @__PURE__ */ (() => SorobanLedgerKeyNonce.type)();
/** Complete executable-tag payload. */
export type ExecutableTag = string | Uint8Array;
/** Lossless executable-tag codec for wire inspection. */
export const ExecutableTag: typeof SorobanExecutableTag.type =
  /* @__PURE__ */ (() => SorobanExecutableTag.type)();
