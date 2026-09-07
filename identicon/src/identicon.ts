import { encodeBase64 } from "@std/encoding/base64";
import { generateIdenticon } from "@/core/generate.ts";
import { assertOptions, resolveOptions } from "@/core/options.ts";
import type {
  IdenticonColor,
  IdenticonData,
  IdenticonDataUrlOptions,
  IdenticonMatrix,
  IdenticonOptions,
} from "@/core/types.ts";
import { IdenticonCode, IdenticonError } from "@/error/index.ts";
import { renderPng } from "@/renderers/png.ts";
import { renderSvg } from "@/renderers/svg.ts";

/**
 * A deterministic SEP-33 account icon, with extended support for C-addresses.
 *
 * G-addresses preserve the established reference output. C-addresses reuse
 * that algorithm with the contract ID bytes; this is a Colibri extension,
 * not defined by SEP-33. No network or deployed contract is required.
 * Icons can collide, including across address types; verify the full address.
 */
export class Identicon {
  readonly #data: IdenticonData;

  /**
   * Validates the address and generates the immutable default identicon.
   * Supports SEP-33 G-addresses and Colibri's same-algorithm C-address extension.
   * @param publicKey - A checksummed Stellar G-address or C-address.
   * @throws {IdenticonError} IDICON_001 if the address is invalid or unsupported.
   */
  constructor(publicKey: string) {
    this.#data = generateIdenticon(publicKey);
  }

  /**
   * The validated G-address or C-address supplied to the constructor.
   * The existing property name is retained; a contract ID is not a public key.
   */
  get publicKey(): string {
    return this.#data.publicKey;
  }

  /** Deeply frozen 7×7 matrix, indexed by row then column. */
  get matrix(): IdenticonMatrix {
    return this.#data.matrix;
  }

  /** Frozen default RGB color; per-render theme overrides do not change it. */
  get color(): IdenticonColor {
    return this.#data.color;
  }

  /**
   * Produces self-contained SVG markup.
   * @param options - Explicit presentation overrides; defaults preserve reference output.
   * @returns SVG string suitable for a file or an inline SVG element.
   * @throws {IdenticonError} If a presentation option is invalid.
   */
  toSvg(options: IdenticonOptions = {}): string {
    return renderSvg(this.#data, resolveOptions(this.#data.hue, options));
  }

  /**
   * Produces PNG bytes synchronously, without Canvas or Node Buffer.
   * @param options - The same geometry and theme controls as SVG.
   * @returns RGBA PNG as a Uint8Array.
   * @throws {IdenticonError} If options are invalid or PNG encoding fails.
   */
  toPng(options: IdenticonOptions = {}): Uint8Array {
    return renderPng(this.#data, resolveOptions(this.#data.hue, options));
  }

  /**
   * Produces a base64 data URL for an image's src attribute.
   * @param options - Required format (svg or png) and optional presentation settings.
   * @returns A data:image/svg+xml;base64 or data:image/png;base64 URL.
   * @throws {IdenticonError} If the format or presentation options are invalid.
   */
  toDataUrl(options: IdenticonDataUrlOptions): string {
    assertOptions(options);
    if (options.format !== "svg" && options.format !== "png") {
      throw new IdenticonError(
        IdenticonCode.INVALID_FORMAT,
        'Data URL format must be "svg" or "png".',
        { format: options.format },
      );
    }
    const svg = options.format === "svg";
    const bytes = svg
      ? new TextEncoder().encode(this.toSvg(options))
      : this.toPng(options);
    return `data:image/${svg ? "svg+xml" : "png"};base64,${
      encodeBase64(bytes)
    }`;
  }
}
