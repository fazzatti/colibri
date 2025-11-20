import type { SigningThreshold } from "@/signer/types.ts";

export const isSigningThreshold = (
  value: number
): value is SigningThreshold => {
  // 0 to 255 is the valid range for a signing threshold
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
  );
};
