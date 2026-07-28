import { Buffer } from "buffer";
import {
  assertEquals,
  assertNotStrictEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { buildAuthorizationEntryPreimage, hash } from "stellar-sdk";
import {
  createWebAuthFixture,
  sep45Entry,
} from "colibri-internal/tests/helpers/webauth/fixtures.ts";
import {
  createTestPasskeyCredential,
  normalizeP256Signature,
  setPasskeyAssertion,
  TEST_PASSKEY_ORIGIN,
  TEST_PASSKEY_RP_ID,
} from "colibri-internal/tests/helpers/sep45/passkey.ts";

function derInteger(value: Uint8Array): Uint8Array {
  let first = 0;
  while (first < value.length - 1 && value[first] === 0) first++;
  let bytes = value.slice(first);
  if (bytes[0] & 0x80) {
    bytes = Uint8Array.from([0, ...bytes]);
  }
  return Uint8Array.from([0x02, bytes.length, ...bytes]);
}

function rawToDer(raw: Uint8Array): Uint8Array {
  const r = derInteger(raw.slice(0, 32));
  const s = derInteger(raw.slice(32));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
}

Deno.test("normalizeP256Signature accepts raw and canonical DER forms", () => {
  const raw = Uint8Array.from(
    { length: 64 },
    (_value, index) => index === 0 ? 0x80 : index === 32 ? 0x40 : index,
  );
  assertEquals(normalizeP256Signature(raw), raw);
  assertNotStrictEquals(normalizeP256Signature(raw), raw);
  assertEquals(normalizeP256Signature(rawToDer(raw)), raw);

  const highS = raw.slice();
  highS.set(
    Buffer.from(
      "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550",
      "hex",
    ),
    32,
  );
  const canonical = normalizeP256Signature(highS);
  assertEquals(canonical.slice(32, 63), new Uint8Array(31));
  assertEquals(canonical[63], 1);

  for (
    const invalid of [
      Uint8Array.of(),
      Uint8Array.of(0x31, 0),
      Uint8Array.of(0x30),
      Uint8Array.of(0x30, 0x80),
      Uint8Array.of(0x30, 0x83, 0, 0, 0),
      Uint8Array.of(0x30, 3, 0x01, 1, 0),
      Uint8Array.of(0x30, 2, 0x02, 0),
      Uint8Array.of(0x30, 4, 0x02, 1, 1, 0),
      Uint8Array.of(0x30, 6, 0x02, 1, 1, 0x02, 1, 1, 0),
    ]
  ) {
    assertThrows(() => normalizeP256Signature(invalid), TypeError);
  }
});

Deno.test("test passkey credential builds a verifiable WebAuthn-shaped assertion", async () => {
  const fixture = createWebAuthFixture();
  const credential = await createTestPasskeyCredential();
  const entry = sep45Entry(fixture, fixture.contractAccount, {
    expiration: 106,
  });
  const context = {
    networkPassphrase: fixture.networkPassphrase,
    validUntilLedgerSeq: 106,
  };
  const assertion = await credential.createAssertion(entry, context);
  assertEquals(credential.publicKey.length, 65);
  assertEquals(credential.publicKey[0], 4);
  const publicKey = credential.publicKey;
  publicKey[0] = 0;
  assertEquals(credential.publicKey[0], 4);
  assertEquals(assertion.authenticatorData.length, 37);
  assertEquals(assertion.authenticatorData[32], 0x05);
  assertEquals(assertion.signature.length, 64);
  const clientData = JSON.parse(
    new TextDecoder().decode(assertion.clientDataJSON),
  );
  assertEquals(clientData.type, "webauthn.get");
  assertEquals(clientData.origin, TEST_PASSKEY_ORIGIN);
  assertEquals(clientData.crossOrigin, false);
  const expectedChallenge = hash(
    buildAuthorizationEntryPreimage(
      entry,
      context.validUntilLedgerSeq,
      context.networkPassphrase,
    ).toXDR(),
  ).toString("base64url");
  assertEquals(clientData.challenge, expectedChallenge);

  const rpIdHash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(TEST_PASSKEY_RP_ID),
    ),
  );
  assertEquals(assertion.authenticatorData.slice(0, 32), rpIdHash);
  const clientHash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      Uint8Array.from(assertion.clientDataJSON),
    ),
  );
  const signed = Uint8Array.from([
    ...assertion.authenticatorData,
    ...clientHash,
  ]);
  const imported = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(credential.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  assertEquals(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      imported,
      Uint8Array.from(assertion.signature),
      signed,
    ),
    true,
  );

  const authorized = await credential.authorize(entry, context);
  const fields = authorized.credentials().address().signature().map()!;
  assertEquals(fields.length, 3);
  assertEquals(fields[0].key().sym().toString(), "authenticator_data");
  assertEquals(fields[2].val().bytes().length, 64);
  assertNotStrictEquals(authorized, entry);

  const manuallySet = setPasskeyAssertion(entry, assertion);
  assertEquals(
    manuallySet.credentials().address().signature().map()?.length,
    3,
  );
});

Deno.test("test passkey assertion binds entry, expiration, and network", async () => {
  const fixture = createWebAuthFixture();
  const credential = await createTestPasskeyCredential();
  const entry = sep45Entry(fixture, fixture.contractAccount);
  const base = {
    networkPassphrase: fixture.networkPassphrase,
    validUntilLedgerSeq: 106,
  };
  const assertion = await credential.createAssertion(entry, base);
  const changedLedger = await credential.createAssertion(entry, {
    ...base,
    validUntilLedgerSeq: 107,
  });
  const changedNetwork = await credential.createAssertion(entry, {
    ...base,
    networkPassphrase: "another network",
  });
  assertEquals(
    new TextDecoder().decode(assertion.clientDataJSON) !==
      new TextDecoder().decode(changedLedger.clientDataJSON),
    true,
  );
  assertEquals(
    new TextDecoder().decode(assertion.clientDataJSON) !==
      new TextDecoder().decode(changedNetwork.clientDataJSON),
    true,
  );

  await assertRejects(
    () =>
      crypto.subtle.importKey(
        "raw",
        Uint8Array.of(4),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      ),
    DOMException,
  );
});
