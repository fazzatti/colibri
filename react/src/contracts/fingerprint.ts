import { sha256 } from "@noble/hashes/sha2.js";
import type { ContractIdentity } from "@/contracts/types.ts";
type Spec = ReturnType<ContractIdentity["getSpec"]>;
const fingerprints = new WeakMap<
  Spec,
  { serialized: string; digest: string }
>();
/** Compact ABI identity; compare current XDR before reusing a fingerprint, including mutable specs. */
export function specFingerprint(spec: Spec): string {
  const serialized = JSON.stringify(
    spec.entries.map((entry) => entry.toXdr("base64")),
  );
  const previous = fingerprints.get(spec);
  if (previous?.serialized === serialized) return previous.digest;
  const digest = Array.from(
    sha256(new TextEncoder().encode(serialized)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  fingerprints.set(spec, { serialized, digest });
  return digest;
}
