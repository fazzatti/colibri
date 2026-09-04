import type { ScValRecord } from "@/common/helpers/xdr/types.ts";

/**
 * Unknown map fields emitted alongside the standardized fields of a SEP-41
 * event.
 *
 * SEP-41 requires consumers to tolerate fields they do not recognize. Values
 * therefore retain Colibri's complete parsed ScVal representation until an
 * application explicitly validates them.
 */
export type SEP41EventExtensions = Readonly<ScValRecord>;

/**
 * Runtime decoder for application-specific SEP-41 event extensions.
 *
 * @typeParam Output Validated or transformed value returned by the decoder.
 */
export type SEP41EventExtensionDecoder<Output> = (
  extensions: SEP41EventExtensions,
) => Output;

/** Parsed value accepted for a SEP-41 muxed destination identifier. */
export type SEP41EventMuxedId = bigint | string | Uint8Array;
