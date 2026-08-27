const HEX = Array.from(
  { length: 256 },
  (_, value) => value.toString(16).padStart(2, "0"),
);

/** Returns the lowercase SHA-256 digest of bytes. */
export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)),
  );
  return Array.from(digest, (byte) => HEX[byte]).join("");
};

/** Performs a constant-work byte comparison for same-length digests. */
export const equalBytes = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
};
