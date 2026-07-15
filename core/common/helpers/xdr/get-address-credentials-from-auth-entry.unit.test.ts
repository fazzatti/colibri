import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, Keypair, xdr } from "stellar-sdk";
import {
  getAddressCredentialsFromAuthEntry,
  tryGetAddressCredentialsFromAuthEntry,
} from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { UNSUPPORTED_AUTH_ENTRY_CREDENTIALS } from "@/common/helpers/xdr/error.ts";

const makeInvocation = (address: Address) =>
  new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction
      .sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: address.toScAddress(),
          functionName: "test",
          args: [],
        }),
      ),
    subInvocations: [],
  });

const makeAddressCredentials = (address: Address) =>
  new xdr.SorobanAddressCredentials({
    address: address.toScAddress(),
    nonce: new xdr.Int64(1),
    signatureExpirationLedger: 123,
    signature: xdr.ScVal.scvVoid(),
  });

const makeEntry = (
  address: Address,
  credentials: xdr.SorobanCredentials,
) =>
  new xdr.SorobanAuthorizationEntry({
    credentials,
    rootInvocation: makeInvocation(address),
  });

describe("getAddressCredentialsFromAuthEntry", () => {
  it("extracts legacy ADDRESS credentials", () => {
    const address = Address.fromString(Keypair.random().publicKey());
    const entry = makeEntry(
      address,
      xdr.SorobanCredentials.sorobanCredentialsAddress(
        makeAddressCredentials(address),
      ),
    );

    const resolved = getAddressCredentialsFromAuthEntry(entry);

    assertEquals(resolved.type, "address");
    assertEquals(
      Address.fromScAddress(resolved.addressCredentials.address()).toString(),
      address.toString(),
    );
  });

  it("extracts Protocol 27 ADDRESS_V2 credentials", () => {
    const address = Address.fromString(Keypair.random().publicKey());
    const entry = makeEntry(
      address,
      xdr.SorobanCredentials.sorobanCredentialsAddressV2(
        makeAddressCredentials(address),
      ),
    );

    const resolved = getAddressCredentialsFromAuthEntry(entry);

    assertEquals(resolved.type, "addressV2");
    assertEquals(
      Address.fromScAddress(resolved.addressCredentials.address()).toString(),
      address.toString(),
    );
  });

  it("extracts top-level credentials and delegates", () => {
    const address = Address.fromString(Keypair.random().publicKey());
    const delegate = Address.fromString(Keypair.random().publicKey());
    const entry = makeEntry(
      address,
      xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(
        new xdr.SorobanAddressCredentialsWithDelegates({
          addressCredentials: makeAddressCredentials(address),
          delegates: [
            new xdr.SorobanDelegateSignature({
              address: delegate.toScAddress(),
              signature: xdr.ScVal.scvVoid(),
              nestedDelegates: [],
            }),
          ],
        }),
      ),
    );

    const resolved = getAddressCredentialsFromAuthEntry(entry);

    assertEquals(resolved.type, "addressWithDelegates");
    if (resolved.type !== "addressWithDelegates") return;
    assertEquals(resolved.delegates.length, 1);
    assertEquals(
      Address.fromScAddress(resolved.delegates[0].address()).toString(),
      delegate.toString(),
    );
  });

  it("returns null for source-account credentials", () => {
    const address = Address.fromString(Keypair.random().publicKey());
    const entry = makeEntry(
      address,
      xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    );

    assertEquals(tryGetAddressCredentialsFromAuthEntry(entry), null);
    assertThrows(
      () => getAddressCredentialsFromAuthEntry(entry),
      UNSUPPORTED_AUTH_ENTRY_CREDENTIALS,
    );
  });
});
