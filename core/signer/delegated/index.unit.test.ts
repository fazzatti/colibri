import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, Keypair, Networks, xdr } from "stellar-sdk";
import { Buffer } from "buffer";
import { DelegatedSigner } from "@/signer/delegated/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import type { AuthEntrySigner } from "@/signer/types.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  Ed25519SecretKey,
} from "@/strkeys/types.ts";
import * as E from "@/signer/delegated/error.ts";

const makeInvocation = (address: Address) =>
  new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction
      .sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: address.toScAddress(),
          functionName: "authorize",
          args: [],
        }),
      ),
    subInvocations: [],
  });

const makeEntry = (
  address: Address,
  credentials:
    | "address"
    | "addressV2"
    | "source" = "addressV2",
) => {
  const addressCredentials = new xdr.SorobanAddressCredentials({
    address: address.toScAddress(),
    nonce: new xdr.Int64(7),
    signatureExpirationLedger: 0,
    signature: xdr.ScVal.scvVoid(),
  });

  const credentialXdr = credentials === "source"
    ? xdr.SorobanCredentials.sorobanCredentialsSourceAccount()
    : credentials === "address"
    ? xdr.SorobanCredentials.sorobanCredentialsAddress(addressCredentials)
    : xdr.SorobanCredentials.sorobanCredentialsAddressV2(addressCredentials);

  return new xdr.SorobanAuthorizationEntry({
    credentials: credentialXdr,
    rootInvocation: makeInvocation(address),
  });
};

const asAddress = (address: Address): Ed25519PublicKey | ContractId =>
  address.toString() as Ed25519PublicKey | ContractId;

describe("DelegatedSigner", () => {
  it("materializes and signs a recursive delegated topology", async () => {
    const rootAddress = Address.contract(Buffer.alloc(32, 1));
    const middleAddress = Address.contract(Buffer.alloc(32, 2));
    const rootKey = Keypair.random();
    const leafKey = Keypair.random();
    const rootLocal = LocalSigner.fromSecret(
      rootKey.secret() as Ed25519SecretKey,
    );
    const leafLocal = LocalSigner.fromSecret(
      leafKey.secret() as Ed25519SecretKey,
    );
    rootLocal.addTarget(asAddress(rootAddress));

    const leaf = new DelegatedSigner({
      address: leafKey.publicKey() as Ed25519PublicKey,
      signer: leafLocal,
    });
    const middle = new DelegatedSigner({
      address: asAddress(middleAddress),
      nestedDelegates: [leaf],
    });
    const root = new DelegatedSigner({
      address: asAddress(rootAddress),
      signer: rootLocal,
      nestedDelegates: [middle],
    });

    const signed = await root.signSorobanAuthEntry(
      makeEntry(rootAddress),
      1234,
      Networks.TESTNET,
    ) as xdr.SorobanAuthorizationEntry;
    const credentials = signed.credentials().addressWithDelegates();
    const middleNode = credentials.delegates()[0];
    const leafNode = middleNode.nestedDelegates()[0];

    assertEquals(
      signed.credentials().switch().value,
      xdr.SorobanCredentialsType.sorobanCredentialsAddressWithDelegates()
        .value,
    );
    assertEquals(
      credentials.addressCredentials().signature().switch().name,
      "scvVec",
    );
    assertEquals(middleNode.signature().switch().name, "scvVoid");
    assertEquals(leafNode.signature().switch().name, "scvVec");
    assertEquals(
      credentials.addressCredentials().signatureExpirationLedger(),
      1234,
    );
  });

  it("supports pure top-level delegation with a void root signature", async () => {
    const rootAddress = Address.contract(Buffer.alloc(32, 3));
    const leafKey = Keypair.random();
    const leaf = new DelegatedSigner({
      address: leafKey.publicKey() as Ed25519PublicKey,
      signer: LocalSigner.fromSecret(leafKey.secret() as Ed25519SecretKey),
    });
    const root = new DelegatedSigner({
      address: asAddress(rootAddress),
      nestedDelegates: [leaf],
    });

    const signed = await root.signSorobanAuthEntry(
      makeEntry(rootAddress, "address"),
      500,
      Networks.TESTNET,
    ) as xdr.SorobanAuthorizationEntry;

    assertEquals(
      signed.credentials().addressWithDelegates().addressCredentials()
        .signature().switch().name,
      "scvVoid",
    );
    assertEquals(
      signed.credentials().addressWithDelegates().delegates()[0].signature()
        .switch().name,
      "scvVec",
    );
  });

  it("canonicalizes siblings and returns defensive topology copies", () => {
    const low = new DelegatedSigner({
      address: asAddress(Address.contract(Buffer.alloc(32, 4))),
    });
    const high = new DelegatedSigner({
      address: asAddress(Address.contract(Buffer.alloc(32, 5))),
    });
    const root = new DelegatedSigner({
      address: asAddress(Address.contract(Buffer.alloc(32, 6))),
      nestedDelegates: [high, low],
    });

    const firstRead = root.getNestedDelegates();
    firstRead.pop();
    const secondRead = root.getNestedDelegates();

    assertEquals(secondRead.length, 2);
    assertEquals(secondRead[0].getAddress(), low.getAddress());
  });

  it("rejects duplicate sibling addresses", () => {
    const duplicateAddress = asAddress(Address.contract(Buffer.alloc(32, 7)));
    const first = new DelegatedSigner({ address: duplicateAddress });
    const second = new DelegatedSigner({ address: duplicateAddress });

    assertThrows(
      () =>
        new DelegatedSigner({
          address: asAddress(Address.contract(Buffer.alloc(32, 8))),
          nestedDelegates: [first, second],
        }),
      E.DUPLICATE_NESTED_DELEGATE,
    );
  });

  it("matches only its represented top-level address", () => {
    const address = asAddress(Address.contract(Buffer.alloc(32, 9)));
    const signer = new DelegatedSigner({ address });

    assertEquals(signer.signsFor(address), true);
    assertEquals(
      signer.signsFor(asAddress(Address.contract(Buffer.alloc(32, 10)))),
      false,
    );
  });

  it("does not rebuild an already delegated entry", async () => {
    const rootAddress = Address.contract(Buffer.alloc(32, 11));
    const root = new DelegatedSigner({
      address: asAddress(rootAddress),
    });
    const delegated = await root.signSorobanAuthEntry(
      makeEntry(rootAddress),
      40,
      Networks.TESTNET,
    ) as xdr.SorobanAuthorizationEntry;
    const sameEntry = await root.signSorobanAuthEntry(
      delegated,
      40,
      Networks.TESTNET,
    );

    assertEquals(
      sameEntry.toXDR("base64"),
      delegated.toXDR("base64"),
    );
    assert(sameEntry === delegated);
  });

  it("wraps invalid recording credentials as a build failure", async () => {
    const rootAddress = Address.contract(Buffer.alloc(32, 12));
    const root = new DelegatedSigner({ address: asAddress(rootAddress) });

    await assertRejects(
      () =>
        root.signSorobanAuthEntry(
          makeEntry(rootAddress, "source"),
          40,
          Networks.TESTNET,
        ),
      E.FAILED_TO_BUILD_DELEGATED_ENTRY,
    );
  });

  it("wraps node signer failures with the credential address", async () => {
    const rootAddress = Address.contract(Buffer.alloc(32, 13));
    const failingSigner: AuthEntrySigner = {
      signsFor: () => true,
      signSorobanAuthEntry: () => Promise.reject(new Error("signer offline")),
    };
    const root = new DelegatedSigner({
      address: asAddress(rootAddress),
      signer: failingSigner,
    });

    const error = await assertRejects(
      () =>
        root.signSorobanAuthEntry(
          makeEntry(rootAddress),
          40,
          Networks.TESTNET,
        ),
      E.FAILED_TO_AUTHORIZE_DELEGATE,
    );

    assertEquals(error.meta.data.address, rootAddress.toString());
    assertEquals(error.meta.cause?.message, "signer offline");
  });

  it("preserves delegated-signer errors raised by a node signer", async () => {
    const rootAddress = asAddress(Address.contract(Buffer.alloc(32, 14)));
    const nestedAddress = asAddress(Address.contract(Buffer.alloc(32, 15)));
    const expected = new E.DUPLICATE_NESTED_DELEGATE(
      rootAddress,
      nestedAddress,
    );
    const failingSigner: AuthEntrySigner = {
      signsFor: () => true,
      signSorobanAuthEntry: () => Promise.reject(expected),
    };
    const root = new DelegatedSigner({
      address: rootAddress,
      signer: failingSigner,
    });

    const actual = await assertRejects(
      () =>
        root.signSorobanAuthEntry(
          makeEntry(Address.fromString(rootAddress)),
          40,
          Networks.TESTNET,
        ),
      E.DUPLICATE_NESTED_DELEGATE,
    );

    assertEquals(actual, expected);
  });
});
