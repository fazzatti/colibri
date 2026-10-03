import type { xdr } from "stellar-sdk";
import { requireSymbolRecord } from "@/soroban-types/codecs/record.ts";
import { isScValRecord } from "@/common/helpers/xdr/scval.ts";
import type { ScValParsed, ScValRecord } from "@/common/helpers/xdr/types.ts";
import type { Event } from "@/event/event.ts";
import type {
  SEP41EventExtensionDecoder,
  SEP41EventExtensions,
  SEP41EventMuxedId,
} from "@/event/standards/sep41/types.ts";

const fields = (event: Event): Map<string, xdr.ScVal> | undefined => {
  try {
    return requireSymbolRecord(event.scvalValue);
  } catch {
    return undefined;
  }
};
const isMuxedId = (value: xdr.ScVal | undefined): boolean =>
  value === undefined || value.type === "scvVoid" || value.type === "scvU64" ||
  value.type === "scvString" ||
  (value.type === "scvBytes" && value.bytes.toBytes().length === 32);

/** @internal */
export const isSEP41AmountEventData = (
  event: Event,
  options: { muxedId: boolean },
): boolean => {
  if (event.scvalValue.type === "scvI128") return true;
  const record = fields(event);
  return record?.get("amount")?.type === "scvI128" &&
    (!options.muxedId || isMuxedId(record.get("to_muxed_id")));
};

/** @internal */
export const isSEP41ApproveEventData = (event: Event): boolean => {
  const raw = event.scvalValue;
  if (raw.type === "scvVec") {
    return raw.vec?.length === 2 && raw.vec[0].type === "scvI128" &&
      raw.vec[1].type === "scvU32";
  }
  const record = fields(event);
  return record?.get("amount")?.type === "scvI128" &&
    record.get("live_until_ledger")?.type === "scvU32";
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
