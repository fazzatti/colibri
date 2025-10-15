import { randomBytes } from "crypto";
import { Buffer } from "buffer";
export const generateRandomSalt = (): Buffer => {
  // Generate 32 cryptographically secure random bytes
  return Buffer.from(randomBytes(32));
};
