/**
 * Muxed data structure for mint and transfer events with muxed addresses.
 */
export type EventMuxedData = {
  amount: bigint;
  to_muxed_id?: bigint | string | Uint8Array;
};
