import { generateIdenticon } from "@/core/generate.ts";
import { resolveOptions } from "@/core/options.ts";
import type { IdenticonOptions } from "@/core/types.ts";
import { renderSvg } from "@/renderers/svg.ts";

/**
 * Renders the same SVG as `new Identicon(address).toSvg(options)` without PNG code.
 * Uses the shared address validation, SEP-33 data, geometry and SVG renderer.
 * Supports checksummed G-addresses and Colibri's C-address extension.
 * @param address - Checksummed Stellar account or contract address.
 * @param options - Geometry and theme overrides; defaults preserve reference output.
 * @returns Self-contained SVG markup, identical to the class's SVG output.
 * @throws {IdenticonError} If the address or a presentation option is invalid.
 */
export function identiconSvg(
  address: string,
  options: IdenticonOptions = {},
): string {
  const data = generateIdenticon(address);
  return renderSvg(data, resolveOptions(data.hue, options));
}
