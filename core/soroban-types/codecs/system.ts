import * as xdr from "stellar-sdk/xdr";
import { SorobanCodec } from "@/soroban-types/codecs/codec.ts";
import {
  largeIntegerType,
  requireTag,
} from "@/soroban-types/codecs/primitives.ts";
import { requireValue } from "@/soroban-types/error.ts";

/** @internal Canonical native representation, preserving SDK interoperability. */
type NativeContractInstance = xdr.ScContractInstance;

/** @internal Encoding rules for contractInstance. */
export function contractInstanceType(): SorobanCodec<
  NativeContractInstance,
  NativeContractInstance,
  "contractInstance"
> {
  return new SorobanCodec(
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

/** @internal Encoding rules for ledgerKeyContractInstance. */
export function ledgerKeyContractInstanceType(): SorobanCodec<
  null,
  null,
  "ledgerKeyContractInstance"
> {
  return new SorobanCodec(
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

/** @internal Encoding rules for ledgerKeyNonce. */
export function ledgerKeyNonceType(): SorobanCodec<
  bigint,
  bigint,
  "ledgerKeyNonce"
> {
  return new SorobanCodec(
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

/** @internal Encoding rules for executableTag. */
export function executableTagType(): SorobanCodec<
  string | Uint8Array,
  string | Uint8Array,
  "executableTag"
> {
  return new SorobanCodec(
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
