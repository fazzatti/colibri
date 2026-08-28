/** Compares two Wasm byte arrays without using hashes as a substitute. */
export const compareWasmBytes = (
  target: Uint8Array,
  rebuilt: Uint8Array,
): boolean => {
  if (target.length !== rebuilt.length) return false;
  let difference = 0;
  for (let index = 0; index < target.length; index += 1) {
    difference |= target[index] ^ rebuilt[index];
  }
  return difference === 0;
};

/** Returns the lowercase SHA-256 digest of exact bytes. */
export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)),
  );
  return Array.from(
    digest,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
};
