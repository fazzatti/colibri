// deno-coverage-ignore-file

import { Buffer } from "buffer";
import { buildAuthorizationEntryPreimage, hash, xdr } from "stellar-sdk";
import type { ContractAuthContext } from "@colibri/webauth";
import type { ContractAuthHandler } from "@colibri/webauth/sep45";
import { cloneSep45AuthorizationEntry } from "@colibri/webauth/sep45";

/** Fixed relying-party ID used only by the internal passkey fixture. */
export const TEST_PASSKEY_RP_ID = "colibri.test";

/** Fixed origin used only by the internal passkey fixture. */
export const TEST_PASSKEY_ORIGIN = "https://colibri.test";

const P256_ORDER =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const P256_HALF_ORDER = P256_ORDER >> 1n;

/** WebAuthn-shaped assertion accepted by the internal account contract. */
export interface TestPasskeyAssertion {
  authenticatorData: Uint8Array;
  clientDataJSON: Uint8Array;
  signature: Uint8Array;
}

/** Programmatically generated, non-persistent test credential. */
export interface TestPasskeyCredential {
  readonly publicKey: Uint8Array;
  createAssertion(
    entry: xdr.SorobanAuthorizationEntry,
    context: ContractAuthContext,
  ): Promise<TestPasskeyAssertion>;
  authorize: ContractAuthHandler;
}

function integerBytes(value: Uint8Array): Uint8Array {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start++;
  return value.slice(start);
}

function readDerLength(
  value: Uint8Array,
  offset: number,
): { length: number; next: number } {
  const first = value[offset];
  if (first === undefined) throw new TypeError("Missing DER length");
  if (first < 0x80) return { length: first, next: offset + 1 };
  const bytes = first & 0x7f;
  if (bytes === 0 || bytes > 2 || offset + bytes >= value.length) {
    throw new TypeError("Unsupported DER length");
  }
  let length = 0;
  for (let index = 0; index < bytes; index++) {
    length = (length << 8) | value[offset + 1 + index];
  }
  return { length, next: offset + 1 + bytes };
}

function readDerInteger(
  value: Uint8Array,
  offset: number,
): { integer: Uint8Array; next: number } {
  if (value[offset] !== 0x02) throw new TypeError("Expected DER integer");
  const length = readDerLength(value, offset + 1);
  const end = length.next + length.length;
  if (length.length === 0 || end > value.length) {
    throw new TypeError("Invalid DER integer length");
  }
  let integer = value.slice(length.next, end);
  if (integer[0] === 0) integer = integer.slice(1);
  if (integer.length === 0 || integer.length > 32) {
    throw new TypeError("ECDSA integer is out of range");
  }
  return { integer, next: end };
}

function bytesToBigInt(value: Uint8Array): bigint {
  let result = 0n;
  for (const byte of value) result = (result << 8n) | BigInt(byte);
  return result;
}

function writeBigInt(value: bigint, target: Uint8Array): void {
  for (let index = target.length - 1; index >= 0; index--) {
    target[index] = Number(value & 0xffn);
    value >>= 8n;
  }
}

function canonicalizeP256Signature(signature: Uint8Array): Uint8Array {
  const normalized = signature.slice();
  const s = bytesToBigInt(normalized.subarray(32));
  if (s > P256_HALF_ORDER) {
    writeBigInt(P256_ORDER - s, normalized.subarray(32));
  }
  return normalized;
}

/**
 * Normalizes Web Crypto's raw or ASN.1 DER P-256 signature to low-S `r || s`.
 */
export function normalizeP256Signature(
  signature: ArrayBuffer | Uint8Array,
): Uint8Array {
  const value = signature instanceof Uint8Array
    ? signature
    : new Uint8Array(signature);
  if (value.length === 64) return canonicalizeP256Signature(value);
  if (value[0] !== 0x30) {
    throw new TypeError("P-256 signature must be raw or DER encoded");
  }
  const sequence = readDerLength(value, 1);
  if (sequence.next + sequence.length !== value.length) {
    throw new TypeError("Invalid DER sequence length");
  }
  const r = readDerInteger(value, sequence.next);
  const s = readDerInteger(value, r.next);
  if (s.next !== value.length) {
    throw new TypeError("Trailing DER signature bytes");
  }
  const normalized = new Uint8Array(64);
  normalized.set(r.integer, 32 - r.integer.length);
  normalized.set(s.integer, 64 - s.integer.length);
  return canonicalizeP256Signature(normalized);
}

function assertionScVal(assertion: TestPasskeyAssertion): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("authenticator_data"),
      val: xdr.ScVal.scvBytes(Buffer.from(assertion.authenticatorData)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("client_data_json"),
      val: xdr.ScVal.scvBytes(Buffer.from(assertion.clientDataJSON)),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(Buffer.from(assertion.signature)),
    }),
  ]);
}

/** Encodes an assertion into a complete cloned authorization entry. */
export function setPasskeyAssertion(
  entry: xdr.SorobanAuthorizationEntry,
  assertion: TestPasskeyAssertion,
): xdr.SorobanAuthorizationEntry {
  const clone = cloneSep45AuthorizationEntry(entry);
  clone.credentials().address().signature(assertionScVal(assertion));
  return clone;
}

/** Generates a fresh synthetic P-256 credential for local tests. */
export async function createTestPasskeyCredential(): Promise<
  TestPasskeyCredential
> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );

  const createAssertion = async (
    entry: xdr.SorobanAuthorizationEntry,
    context: ContractAuthContext,
  ): Promise<TestPasskeyAssertion> => {
    const preimage = buildAuthorizationEntryPreimage(
      entry,
      context.validUntilLedgerSeq,
      context.networkPassphrase,
    );
    const challenge = hash(preimage.toXDR()).toString("base64url");
    const clientDataJSON = new TextEncoder().encode(JSON.stringify({
      type: "webauthn.get",
      challenge,
      origin: TEST_PASSKEY_ORIGIN,
      crossOrigin: false,
    }));
    const rpIdHash = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(TEST_PASSKEY_RP_ID),
      ),
    );
    const authenticatorData = new Uint8Array(37);
    authenticatorData.set(rpIdHash);
    authenticatorData[32] = 0x05;
    const clientDataHash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", clientDataJSON),
    );
    const signedData = new Uint8Array(
      authenticatorData.length + clientDataHash.length,
    );
    signedData.set(authenticatorData);
    signedData.set(clientDataHash, authenticatorData.length);
    const signature = normalizeP256Signature(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        keyPair.privateKey,
        signedData,
      ),
    );
    return { authenticatorData, clientDataJSON, signature };
  };

  const authorize: ContractAuthHandler = async (entry, context) =>
    setPasskeyAssertion(
      entry,
      await createAssertion(entry, context),
    );

  return {
    get publicKey() {
      return publicKey.slice();
    },
    createAssertion,
    authorize,
  };
}
