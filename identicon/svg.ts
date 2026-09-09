/**
 * SVG-only SEP-33 identicons, with Colibri's C-address extension.
 * Shares the class renderer and validation; does not import a PNG encoder.
 * @example
 * ```ts
 * import { identiconSvg } from "@colibri/identicon/svg";
 * const svg = identiconSvg("GALAXYVOIDAOPZTDLHILAJQKCVVFMD4IKLXLSZV5YHO7VY74IWZILUTO");
 * console.log(svg);
 * ```
 * @module
 */
export { identiconSvg } from "@/svg.ts";
export { IdenticonCode, IdenticonError } from "@/error/index.ts";
export type { IdenticonOptions } from "@/core/types.ts";
