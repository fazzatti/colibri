/** Public consumer probes: no private imports or tree-shaking overrides. */
export const entries: Record<string, string> = {
  "react-provider":
    'export {ColibriProvider,createColibriConfig,useConnection,useNetwork} from "@colibri/react";',
  "react-query":
    'export {colibriQueryKey,colibriQueryOptions} from "@colibri/react/query";',
  "react-read":
    'export {useContractReadSpec} from "@colibri/react/contracts/read";',
  "react-invoke":
    'export {useContractInvoke} from "@colibri/react/contracts/invoke";',
  "core-read": 'export {readContract} from "@colibri/core/contract-read";',
  "react-identicon": 'export {useIdenticon} from "@colibri/react/identicon";',
  "react-classic":
    'export {useClassicTransaction} from "@colibri/react/transactions/classic";',
  "react-assets": 'export {useBalance} from "@colibri/react/assets";',
  "react-webauth":
    'export {useWebAuthClient,useWebAuth} from "@colibri/react/webauth";',

  "unused-core": 'import "@colibri/core"; export const value = 1;',
  "root-error": 'export { ColibriError } from "@colibri/core";',
  "root-strkey": 'export { StrKey } from "@colibri/core";',
  errors: 'export { ColibriError } from "@colibri/core/errors";',
  strkey: 'export { StrKey } from "@colibri/core/strkey";',
  "svg-class":
    'import { Identicon } from "@colibri/identicon"; export const toSvg = (address) => new Identicon(address).toSvg();',
  "svg-root": 'export { identiconSvg as toSvg } from "@colibri/identicon";',
  svg: 'export { identiconSvg as toSvg } from "@colibri/identicon/svg";',
  "value-symbol":
    'import * as SorobanType from "@colibri/core/values"; export const symbol = SorobanType.Symbol;',
  "value-namespace":
    'import { SorobanType } from "@colibri/core/values"; export const symbol = SorobanType.Symbol;',
  interop: `
import { ColibriError, StrKey, Spec, SorobanType, SorobanValueError } from "@colibri/core";
import * as DirectTypes from "@colibri/core/values";
import { SorobanType as TypeLeaf, SorobanValueError as ValueErrorLeaf } from "@colibri/core/values";
import { ColibriError as ErrorLeaf } from "@colibri/core/errors";
import { StrKey as KeyLeaf } from "@colibri/core/strkey";
import { Identicon, identiconSvg as rootSvg } from "@colibri/identicon";
import { identiconSvg } from "@colibri/identicon/svg";
import { Spec as NativeSpec } from "stellar-sdk/contract";
export function verify(address) {
  if (ColibriError !== ErrorLeaf || StrKey !== KeyLeaf || Spec !== NativeSpec || identiconSvg !== rootSvg) throw new Error("Constructor/function identity changed");
  if (SorobanType !== TypeLeaf || SorobanType.Symbol !== TypeLeaf.Symbol || SorobanType.Symbol !== DirectTypes.Symbol || SorobanType.Custom !== DirectTypes.Custom || SorobanValueError !== ValueErrorLeaf) throw new Error("Value constructor identity changed");
  const role = SorobanType.Symbol.from("ADMIN");
  if (SorobanType.Symbol.fromXdr(role.toXdr("base64")).value !== "ADMIN") throw new Error("Value round trip changed");
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
  "react-provider": [22000, 8000],
  "react-query": [4000, 2000],
  "react-read": [880000, 200000],
  "react-invoke": [22000, 8000],
  "core-read": [850000, 190000],
  "react-identicon": [33000, 13000],
  "react-classic": [875000, 200000],
  "react-assets": [1070000, 245000],
  "react-webauth": [1150000, 265000],
  "unused-core": [1_010_000, 225_000],
  "root-error": [1_010_000, 225_000],
  "root-strkey": [1_010_000, 225_000],
  errors: [2_000, 1_000],
  "value-symbol": [90_000, 25_000],
  "value-namespace": [310_000, 80_000],
  strkey: [20_000, 8_000],
  svg: [22_000, 9_000],
  "svg-root": [22_000, 9_000],
  "svg-class": [45_000, 17_000],
};

export function forbiddenDependencies(name: string): RegExp[] {
  const png = /(?:fast-png|fflate)/;
  const heavy =
    /(?:stellar[-+]xdr|@stellar[+/]js-xdr|convee|\/(?:contract|rpc|xdr|ledger-parser|processes|pipelines)\/|\/(?:transaction|xdr)[^/]*\.[cm]?[jt]s)/;
  if (
    ["react-provider", "react-query", "react-invoke", "react-identicon"]
      .includes(name)
  ) return [png, heavy, /\/(?:webauth|rpc-streamer)\//];
  if (["core-read", "react-read"].includes(name)) {
    return [
      png,
      /\/core\/(?:signer|processes\/(?:sign-auth-entries|sign-envelope|send-transaction)|pipelines\/(?:classic-transaction|invoke-contract))\//,
    ];
  }
  if (name === "value-symbol" || name === "value-namespace") {
    return [
      png,
      /(?:convee|\/(?:rpc|horizon|pipelines|processes|ledger-parser)\/)/,
    ];
  }
  if (name === "errors") return [png, heavy, /(?:stellar|base32|sha256)/];
  if (["strkey", "svg"].includes(name)) return [png, heavy];
  return [];
}
