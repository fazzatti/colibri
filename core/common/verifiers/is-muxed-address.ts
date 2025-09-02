import { regex } from "../../mod.ts";

export const isMuxedAddress = (value: string): boolean => {
  return typeof value === "string" && regex.muxedAddress.test(value);
};
