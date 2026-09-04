import type { xdr } from "stellar-sdk";
import { isScValRecord } from "@/common/helpers/xdr/scval.ts";
import type { ScValParsed, ScValRecord } from "@/common/helpers/xdr/types.ts";
import type { Event } from "@/event/event.ts";
import type {
  SEP41EventExtensionDecoder,
  SEP41EventExtensions,
  SEP41EventMuxedId,
} from "@/event/standards/sep41/types.ts";

const UINT32_MAX = 0xffff_ffff;

const isUint32 = (value: ScValParsed): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= UINT32_MAX;

const isMuxedId = (
  value: ScValParsed | undefined,
): value is SEP41EventMuxedId | null | undefined =>
  value === undefined ||
  value === null ||
  typeof value === "bigint" ||
  typeof value === "string" ||
  value instanceof Uint8Array;

const isSymbolKeyedMap = (event: Event): boolean => {
  const raw = event.scvalValue as xdr.ScVal;
  if (raw.type !== "scvMap") return false;
  return (raw.map ?? []).every((entry) => entry.key.type === "scvSymbol");
};

/** @internal */
export const isSEP41AmountEventData = (
  event: Event,
  options: { muxedId: boolean },
): boolean => {
  const value = event.value;
  if (typeof value === "bigint") return true;
  if (!isScValRecord(value) || !isSymbolKeyedMap(event)) return false;
  if (typeof value.amount !== "bigint") return false;

  return !options.muxedId || isMuxedId(value.to_muxed_id);
};

/** @internal */
export const isSEP41ApproveEventData = (event: Event): boolean => {
  const value = event.value;
  if (Array.isArray(value)) {
    return value.length === 2 &&
      typeof value[0] === "bigint" &&
      isUint32(value[1]);
  }

  return isScValRecord(value) &&
    isSymbolKeyedMap(event) &&
    typeof value.amount === "bigint" &&
    isUint32(value.live_until_ledger);
};

/** @internal */
export const getSEP41Amount = (value: ScValParsed): bigint => {
  if (typeof value === "bigint") return value;
  return (value as ScValRecord).amount as bigint;
};

/** @internal */
export const getSEP41ApproveData = (
  value: ScValParsed,
): { amount: bigint; liveUntilLedger: number } => {
  if (Array.isArray(value)) {
    return {
      amount: value[0] as bigint,
      liveUntilLedger: value[1] as number,
    };
  }

  const record = value as ScValRecord;
  return {
    amount: record.amount as bigint,
    liveUntilLedger: record.live_until_ledger as number,
  };
};

/** @internal */
export const getSEP41MuxedId = (
  value: ScValParsed,
): SEP41EventMuxedId | undefined => {
  if (!isScValRecord(value)) return undefined;
  const muxedId = value.to_muxed_id;
  return muxedId === null || muxedId === undefined ? undefined : muxedId as
    | SEP41EventMuxedId
    | undefined;
};

/** @internal */
export const getSEP41EventExtensions = (
  value: ScValParsed,
  standardFields: readonly string[],
): SEP41EventExtensions => {
  if (!isScValRecord(value)) return Object.freeze({});

  const standard = new Set(standardFields);
  const extensions = Object.fromEntries(
    Object.entries(value).filter(([key]) => !standard.has(key)),
  ) as ScValRecord;
  return Object.freeze(extensions);
};

/** @internal */
export const decodeSEP41EventExtensions = <Output>(
  extensions: SEP41EventExtensions,
  decoder: SEP41EventExtensionDecoder<Output>,
  error: (cause: Error, extensionKeys: readonly string[]) => Error,
): Output => {
  try {
    return decoder(extensions);
  } catch (cause) {
    const normalized = cause instanceof Error
      ? cause
      : new Error(String(cause));
    throw error(normalized, Object.keys(extensions));
  }
};
