import { canonicalMap, requireOrderedMap } from "@/values/ordering.ts";
import { nativeToScVal } from "stellar-sdk/base";
import * as xdr from "stellar-sdk/xdr";
import { requireValue } from "@/values/error.ts";
import { SorobanCodec, SorobanValue } from "@/values/value.ts";

/** @internal Verifies contract-usable values; system-only variants remain available via SorobanVal. */
export function requireContractValue(value: xdr.ScVal): void {
  switch (value.type) {
    case "scvContractInstance":
    case "scvLedgerKeyContractInstance":
    case "scvLedgerKeyNonce":
    case "scvExecutableTag":
      requireValue(
        false,
        "val",
        `${value.type} is a system value, not a contract argument`,
      );
      break;
    case "scvVec":
      requireValue(value.vec !== null, "val", "null wire vector");
      value.vec.forEach(requireContractValue);
      break;
    case "scvMap":
      requireValue(value.map !== null, "val", "null wire map");
      requireOrderedMap(value.map);
      value.map.forEach((entry) => {
        requireContractValue(entry.key);
        requireContractValue(entry.val);
      });
      break;
    case "scvSymbol":
      requireValue(
        /^[A-Za-z0-9_]{0,32}$/.test(value.sym.toString()),
        "symbol",
        "expected at most 32 ASCII letters, digits or underscores",
      );
      break;
    case "scvAddress":
      requireValue(
        [
          "scAddressTypeAccount",
          "scAddressTypeContract",
          "scAddressTypeMuxedAccount",
        ].includes(value.address.type),
        "val",
        "unsupported contract address kind",
      );
      break;
  }
}

function encodeGeneric(
  value: unknown,
  ancestors = new Set<object>(),
): xdr.ScVal {
  if (
    value === null || typeof value !== "object" || value instanceof SorobanValue
  ) {
    return encodeGenericValue(value, ancestors);
  }
  requireValue(!ancestors.has(value), "val", "cyclic value");
  ancestors.add(value);
  try {
    return encodeGenericValue(value, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function encodeGenericValue(value: unknown, ancestors: Set<object>): xdr.ScVal {
  if (value instanceof SorobanValue) return value.toScVal();
  if (Array.isArray(value)) {
    return xdr.ScVal.scvVec(
      value.map((item) => encodeGeneric(item, ancestors)),
    );
  }
  if (value instanceof Map) {
    return xdr.ScVal.scvMap(
      canonicalMap(
        [...value].map(([key, val]) =>
          new xdr.ScMapEntry({
            key: encodeGeneric(key, ancestors),
            val: encodeGeneric(val, ancestors),
          })
        ),
      ),
    );
  }
  if (
    value && typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return xdr.ScVal.scvMap(
      canonicalMap(
        Object.entries(value).map(([key, val]) =>
          new xdr.ScMapEntry({
            key: nativeToScVal(key),
            val: encodeGeneric(val, ancestors),
          })
        ),
      ),
    );
  }
  return nativeToScVal(value);
}

/** @internal Generic contract values retain their ScVal because native decoding may lose type information. */
export function contractValType(): SorobanCodec<unknown, xdr.ScVal, "val"> {
  return new SorobanCodec("val", "val", (value) => {
    const encoded = encodeGeneric(value);
    requireContractValue(encoded);
    return encoded;
  }, (value) => {
    requireContractValue(value);
    return value;
  }, true);
}
