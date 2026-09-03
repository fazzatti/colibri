/**
 * Reference-compatible SEP-33 Stellar identicons as SVG, PNG and data URLs.
 *
 * Generation is local and deterministic; no DOM, Canvas or network is needed.
 *
 * @example
 * ```ts
 * import { Identicon } from "@colibri/identicon";
 *
 * const icon = new Identicon(
 *   "GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO",
 * );
 * const svg = icon.toSvg();
 * const png = icon.toPng();
 * const src = icon.toDataUrl({ format: "svg" });
 * ```
 *
 * @module
 */
export { Identicon } from "@/identicon.ts";
export { generateIdenticon } from "@/core/generate.ts";
export { IdenticonCode, IdenticonError } from "@/error/index.ts";
export type {
  IdenticonColor,
  IdenticonData,
  IdenticonDataUrlOptions,
  IdenticonMatrix,
  IdenticonOptions,
} from "@/core/types.ts";
