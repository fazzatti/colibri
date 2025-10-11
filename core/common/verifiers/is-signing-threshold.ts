import type { SigningThreshold } from "../../signer/types.ts";

export const isSigningThreshold = (
  value: number
): value is SigningThreshold => {
  return typeof value === "number" && value > 0 && value <= 255;
};
