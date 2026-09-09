/** Public consumer probes: no private imports or tree-shaking overrides. */
export const entries: Record<string, string> = {
  "unused-core": 'import "@colibri/core"; export const value = 1;',
  "root-error": 'export { ColibriError } from "@colibri/core";',
  "root-strkey": 'export { StrKey } from "@colibri/core";',
  errors: 'export { ColibriError } from "@colibri/core/errors";',
  strkey: 'export { StrKey } from "@colibri/core/strkey";',
  "svg-class":
    'import { Identicon } from "@colibri/identicon"; export const toSvg = (address) => new Identicon(address).toSvg();',
  "svg-root": 'export { identiconSvg as toSvg } from "@colibri/identicon";',
  svg: 'export { identiconSvg as toSvg } from "@colibri/identicon/svg";',
  "value-symbol": 'export { SorobanSymbol } from "@colibri/core/values";',
  interop: `
import { ColibriError, StrKey, Spec, SorobanSymbol, SorobanValueError } from "@colibri/core";
import { SorobanSymbol as SymbolLeaf, SorobanValueError as ValueErrorLeaf } from "@colibri/core/values";
import { ColibriError as ErrorLeaf } from "@colibri/core/errors";
import { StrKey as KeyLeaf } from "@colibri/core/strkey";
import { Identicon, identiconSvg as rootSvg } from "@colibri/identicon";
import { identiconSvg } from "@colibri/identicon/svg";
import { Spec as NativeSpec } from "stellar-sdk/contract";
export function verify(address) {
  if (ColibriError !== ErrorLeaf || StrKey !== KeyLeaf || Spec !== NativeSpec || identiconSvg !== rootSvg) throw new Error("Constructor/function identity changed");
  if (SorobanSymbol !== SymbolLeaf || SorobanValueError !== ValueErrorLeaf) throw new Error("Value constructor identity changed");
  const role = new SorobanSymbol("ADMIN");
  if (SorobanSymbol.type.fromXdr(role.toXdr("base64")).value !== "ADMIN") throw new Error("Value round trip changed");
  const icon = new Identicon(address);
  if (icon.toSvg() !== identiconSvg(address)) throw new Error("SVG output changed");
  if (Array.from(icon.toPng().slice(0,8)).join() !== "137,80,78,71,13,10,26,10") throw new Error("PNG rendering changed");
  try { identiconSvg("invalid"); } catch (error) {
    if (!(error instanceof ColibriError) || error.code !== "IDICON_001") throw error;
    return true;
  }
  throw new Error("Address validation missing");
}`,
};

/** Independent budgets for each consumer, in raw bytes and gzip level 9 bytes. */
export const budgets: Record<string, readonly [number, number]> = {
  "unused-core": [1_010_000, 225_000],
  "root-error": [1_010_000, 225_000],
  "root-strkey": [1_010_000, 225_000],
  errors: [2_000, 1_000],
  "value-symbol": [90_000, 25_000],
  strkey: [20_000, 8_000],
  svg: [22_000, 9_000],
  "svg-root": [22_000, 9_000],
  "svg-class": [45_000, 17_000],
};

export function forbiddenDependencies(name: string): RegExp[] {
  const png = /(?:fast-png|fflate)/;
  const heavy =
    /(?:stellar[-+]xdr|@stellar[+/]js-xdr|convee|\/(?:contract|rpc|xdr|ledger-parser|processes|pipelines)\/|\/(?:transaction|xdr)[^/]*\.[cm]?[jt]s)/;
  if (name === "value-symbol") {
    return [
      png,
      /(?:convee|\/(?:rpc|horizon|pipelines|processes|ledger-parser)\/)/,
    ];
  }
  if (name === "errors") return [png, heavy, /(?:stellar|base32|sha256)/];
  if (["strkey", "svg"].includes(name)) return [png, heavy];
  return [];
}
