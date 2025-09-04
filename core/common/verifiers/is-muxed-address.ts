import { regex } from "../../mod.ts";
import type { MuxedAddress } from "../types.ts";

export const isMuxedAddress = (address: string): address is MuxedAddress => {
  return typeof address === "string" && regex.muxedAddress.test(address);
};
