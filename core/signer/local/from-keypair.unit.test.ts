import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Address,
  authorizeEntry,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "stellar-sdk";
import { normalizeBinaryData } from "@/common/helpers/binary.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import * as E from "@/signer/local/error.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

describe("LocalSigner.fromKeypair", () => {
  it("borrows the key without extracting secrets and targets only its own account", () => {
    const keypair = Keypair.random();
    keypair.secret = () => {
      throw new Error("Secret extraction is forbidden");
    };
    const properties = Reflect.ownKeys(keypair);
    const signer = LocalSigner.fromKeypair(keypair, true);
    assert(signer instanceof LocalSigner);
    assertEquals(signer.publicKey(), keypair.publicKey());
    assertEquals(signer.getTargets(), [keypair.publicKey()]);
    assertEquals(Reflect.ownKeys(keypair), properties);
    assertEquals(
      JSON.stringify(signer),
      JSON.stringify({ publicKey: keypair.publicKey() }),
    );
    assertThrows(() => signer.secretKey(), E.SECRET_NOT_ACCESSIBLE);
    const other = Keypair.random().publicKey() as Ed25519PublicKey;
    assertEquals(signer.signsFor(other), false);
    signer.addTarget(other);
    assert(signer.signsFor(other));
    signer.removeTarget(other);
    assertEquals(signer.signsFor(other), false);
  });

  it("retains default secret visibility and caller ownership through disposal", () => {
    const keypair = Keypair.random();
    const signer = LocalSigner.fromKeypair(keypair);
    assertEquals(signer.secretKey(), keypair.secret());
    const bytes = new TextEncoder().encode("ownership");
    const signature = signer.sign(bytes);
    assert(keypair.verify(bytes, normalizeBinaryData(signature)));
    signer[Symbol.dispose]();
    signer.destroy();
    assertThrows(() => signer.sign(bytes), E.SIGNER_DESTROYED);
    assertThrows(() => signer.secretKey(), E.SIGNER_DESTROYED);
    assert(keypair.canSign());
    assert(keypair.verify(bytes, keypair.sign(bytes)));
    assert(signer.verifySignature(bytes, signature));
    assertEquals(signer.publicKey(), keypair.publicKey());
    const another = LocalSigner.fromKeypair(keypair);
    assert(keypair.verify(bytes, normalizeBinaryData(another.sign(bytes))));
  });

  it("uses the native key for envelopes and SEP-53 messages", () => {
    const keypair = Keypair.random();
    const signer = LocalSigner.fromKeypair(keypair);
    const transaction = new TransactionBuilder(
      new Account(signer.publicKey(), "1"),
      {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
      },
    ).addOperation(Operation.setOptions({})).setTimeout(0).build();
    const signed = TransactionBuilder.fromXdr(
      signer.signTransaction(transaction),
      Networks.TESTNET,
    );
    assert(
      keypair.verify(signed.hash(), signed.signatures[0].signature.toBytes()),
    );
    const signature = signer.signMessage("message");
    assert(keypair.verifyMessage("message", signature));
    signer.destroy();
    assert(signer.verifyMessage("message", signature));
    assertThrows(
      () => signer.signMessage("message"),
      E.MESSAGE_SIGNER_DESTROYED,
    );
    assertThrows(() => signer.signTransaction(transaction), E.SIGNER_DESTROYED);
  });

  it("preserves native Soroban authorization encoding including explicit forAddress", async () => {
    const keypair = Keypair.random();
    const signer = LocalSigner.fromKeypair(keypair);
    const entry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: new Address(keypair.publicKey()).toScAddress(),
          nonce: xdr.Int64(7),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVec([]),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: Address.contract(new Uint8Array(32))
                .toScAddress(),
              functionName: "noop",
              args: [],
            }),
          ),
        subInvocations: [],
      }),
    });
    const actual = await signer.signSorobanAuthEntry(
      entry,
      123,
      Networks.TESTNET,
      signer.publicKey(),
    );
    const expected = await authorizeEntry(
      entry,
      keypair,
      123,
      Networks.TESTNET,
      keypair.publicKey(),
    );
    assertEquals(actual.toXdr("base64"), expected.toXdr("base64"));
    signer.destroy();
    assertThrows(
      () => signer.signSorobanAuthEntry(entry, 123, Networks.TESTNET),
      E.SIGNER_DESTROYED,
    );
  });

  it("accepts native keypairs across package instances without relying on instanceof", () => {
    const original = Keypair.random();
    const equivalent = {
      canSign: original.canSign.bind(original),
      publicKey: original.publicKey.bind(original),
      sign: original.sign.bind(original),
    } as Keypair;
    const signer = LocalSigner.fromKeypair(equivalent, true);
    const bytes = new Uint8Array([1, 2]);
    assert(original.verify(bytes, normalizeBinaryData(signer.sign(bytes))));
    signer.destroy();
    assert(original.verify(bytes, original.sign(bytes)));
  });

  it("rejects public-only keys and wraps failed adaptation without retaining inputs", () => {
    const readonly = Keypair.fromPublicKey(Keypair.random().publicKey());
    const error = assertThrows(
      () => LocalSigner.fromKeypair(readonly),
      E.KEYPAIR_CANNOT_SIGN,
    );
    assertEquals(error.code, "SIG_LOC_007");
    assertEquals(error.meta.data, null);
    for (const method of ["canSign", "publicKey"] as const) {
      const keypair = Keypair.random();
      const cause = new Error("provider failure");
      keypair[method] = () => {
        throw cause;
      };
      const failed = assertThrows(
        () => LocalSigner.fromKeypair(keypair),
        E.KEYPAIR_ADAPTATION_FAILED,
      );
      assertEquals(failed.code, "SIG_LOC_008");
      assertStrictEquals(failed.meta.cause, cause);
      assertEquals(failed.meta.data, null);
    }
  });
});
