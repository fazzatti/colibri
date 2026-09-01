/** Generates a cryptographically secure 32-byte contract salt. */
export const generateRandomSalt = (): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(32));
