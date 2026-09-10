import type * as xdr from "stellar-sdk/xdr";
import type { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import { SorobanValue } from "@/soroban-types/values/value.ts";
import {
  contractInstanceType,
  executableTagType,
  ledgerKeyContractInstanceType,
  ledgerKeyNonceType,
} from "@/soroban-types/codecs/system.ts";

/** @internal Canonical native representation, preserving SDK interoperability. */
type NativeContractInstance = xdr.ScContractInstance;

/** Lossless contract-instance value for ledger inspection, not ordinary arguments. */
export class SorobanContractInstance
  extends SorobanValue<NativeContractInstance, "contractInstance"> {
  /** Validates and snapshots a native contract instance including executable and storage. */
  constructor(value: NativeContractInstance) {
    super(SorobanContractInstance.type, value);
  }
  /** Codec for the complete native contract-instance representation. */
  static readonly type: SorobanCodec<
    NativeContractInstance,
    NativeContractInstance,
    "contractInstance"
  > = /* @__PURE__ */ contractInstanceType();
}

/** Reserved contract-instance ledger key. */
export class SorobanLedgerKeyContractInstance
  extends SorobanValue<null, "ledgerKeyContractInstance"> {
  /** Creates the reserved key without a payload. */
  constructor() {
    super(SorobanLedgerKeyContractInstance.type, null);
  }
  /** Codec for the payload-free system key. */
  static readonly type: SorobanCodec<null, null, "ledgerKeyContractInstance"> =
    /* @__PURE__ */ ledgerKeyContractInstanceType();
}

/** Reserved nonce ledger key, retaining the signed 64-bit nonce. */
export class SorobanLedgerKeyNonce
  extends SorobanValue<bigint, "ledgerKeyNonce"> {
  /** Validates and snapshots the nonce. */
  constructor(value: bigint) {
    super(SorobanLedgerKeyNonce.type, value);
  }
  /** Codec for the complete nonce key. */
  static readonly type: SorobanCodec<bigint, bigint, "ledgerKeyNonce"> =
    /* @__PURE__ */ ledgerKeyNonceType();
}

/** System executable tag; arbitrary wire bytes remain lossless. */
export class SorobanExecutableTag
  extends SorobanValue<string | Uint8Array, "executableTag"> {
  /** Snapshots the tag's native text or bytes. */
  constructor(value: string | Uint8Array) {
    super(SorobanExecutableTag.type, value);
  }
  /** Codec for a system executable tag. */
  static readonly type: SorobanCodec<
    string | Uint8Array,
    string | Uint8Array,
    "executableTag"
  > = /* @__PURE__ */ executableTagType();
}
