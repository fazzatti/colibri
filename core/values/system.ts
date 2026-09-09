/** @internal Canonical native representation, preserving SDK interoperability. */
type NativeContractInstance = xdr.ScContractInstance;
import * as xdr from "stellar-sdk/xdr";
import { SorobanCodec, SorobanValue } from "@/values/value.ts";
import { largeIntegerType, requireTag } from "@/values/scalars.ts";
import { requireValue } from "@/values/error.ts";

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
  > = /* @__PURE__ */ new SorobanCodec(
    "contractInstance",
    "contractInstance",
    (value) => {
      requireValue(
        value instanceof xdr.ScContractInstance,
        "contractInstance",
        "expected native ScContractInstance",
      );
      return xdr.ScVal.scvContractInstance(value);
    },
    (value) => {
      requireTag(value, "scvContractInstance");
      return value.instance;
    },
  );
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
    /* @__PURE__ */ new SorobanCodec(
      "ledgerKeyContractInstance",
      "ledgerKeyContractInstance",
      (value) => {
        requireValue(
          value === null,
          "ledgerKeyContractInstance",
          "expected no payload",
        );
        return xdr.ScVal.scvLedgerKeyContractInstance();
      },
      (value) => {
        requireTag(value, "scvLedgerKeyContractInstance");
        return null;
      },
    );
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
    /* @__PURE__ */ new SorobanCodec(
      "ledgerKeyNonce",
      "ledgerKeyNonce",
      (value) => {
        const nonce = largeIntegerType("i64").decode(
          largeIntegerType("i64").encodeUnknown(value),
        );
        return xdr.ScVal.scvLedgerKeyNonce(new xdr.ScNonceKey({ nonce }));
      },
      (value) => {
        requireTag(value, "scvLedgerKeyNonce");
        return value.nonceKey.nonce;
      },
    );
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
  > = /* @__PURE__ */ new SorobanCodec(
    "executableTag",
    "executableTag",
    (value) => {
      requireValue(
        typeof value === "string" || value instanceof Uint8Array,
        "executableTag",
        "expected text or bytes",
      );
      return xdr.ScVal.scvExecutableTag(value);
    },
    (value) => {
      requireTag(value, "scvExecutableTag");
      return value.executableTag.asStringOrBytes();
    },
  );
}
