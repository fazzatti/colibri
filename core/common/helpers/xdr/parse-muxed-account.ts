import { StrKey } from "@/strkeys/index.ts";
import { UNKNOWN_MUXED_ACCOUNT_TYPE } from "@/common/helpers/xdr/error.ts";
import type { xdr } from "stellar-sdk";

/**
 * Parse a MuxedAccount XDR to a Stellar address.
 *
 * Returns either a regular account (G...) or a muxed account (M...) depending on the type.
 *
 * @param muxedXdr - MuxedAccount XDR object
 * @returns Stellar address (G... or M...)
 *
 * @example
 * ```ts
 * parseMuxedAccount(muxed); // "GXXXX..." or "MXXXX..."
 * ```
 * @internal
 */
export function parseMuxedAccount(muxedXdr: xdr.MuxedAccount): string {
  switch (muxedXdr.type) {
    case "keyTypeEd25519":
      return StrKey.encodeEd25519PublicKey(muxedXdr.ed25519.toBytes());

    case "keyTypeMuxedEd25519": {
      const med = muxedXdr.med25519;
      const ed25519 = med.ed25519.toBytes(); // 32 bytes
      const id = med.id; // bigint

      // encodeMed25519PublicKey expects 40 bytes: 32 bytes ed25519 + 8 bytes id (big-endian)
      const idBuffer = new Uint8Array(8);
      const view = new DataView(idBuffer.buffer);
      view.setBigUint64(0, id, false); // false = big-endian

      // Combine ed25519 and idBuffer
      const combined = new Uint8Array(40);
      combined.set(ed25519, 0);
      combined.set(idBuffer, 32);

      return StrKey.encodeMed25519PublicKey(combined);
    }

    default:
      throw new UNKNOWN_MUXED_ACCOUNT_TYPE(
        (muxedXdr as { type: string }).type,
      );
  }
}
