import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, xdr } from "stellar-sdk/base";
import { LocalSigner, NetworkConfig } from "@colibri/core";
import { createWalletAuthEntrySigner } from "@/wallets/auth-entry/index.ts";
import { ColibriReactError } from "@/errors/index.ts";

const account = LocalSigner.generateRandom().publicKey();
const other = LocalSigner.generateRandom().publicKey();
const passphrase = NetworkConfig.TestNet().networkPassphrase;
function entry(address = account, nonce = 7n, expiry = 0) {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(address).toScAddress(),
        nonce,
        signatureExpirationLedger: expiry,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction
        .sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(
              "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
            ).toScAddress(),
            functionName: "claim",
            args: [],
          }),
        ),
      subInvocations: [],
    }),
  });
}
describe("wallet auth-entry bridge", () => {
  it("sets an immutable expiry and preserves the complete payload", async () => {
    const input = entry();
    const before = input.toXdr("base64");
    let calls = 0;
    const signer = createWalletAuthEntrySigner({
      address: account,
      networkPassphrase: passphrase,
      signAuthEntry: (value, network) => {
        calls++;
        assertEquals(network, passphrase);
        assertEquals(value, entry(account, 7n, 150).toXdr("base64"));
        return Promise.resolve(value);
      },
    });
    assertEquals(signer.signsFor(account), true);
    assertEquals(signer.signsFor(other), false);
    await signer.signSorobanAuthEntry(input, 150, passphrase, account);
    assertEquals(input.toXdr("base64"), before);
    assertEquals(calls, 1);
    for (const expiry of [0, -1, 1.5, 2 ** 32]) {
      await assertRejects(
        () => signer.signSorobanAuthEntry(input, expiry, passphrase),
        ColibriReactError,
      );
    }
    await assertRejects(
      () => signer.signSorobanAuthEntry(input, 150, "wrong"),
      ColibriReactError,
    );
    await assertRejects(
      () => signer.signSorobanAuthEntry(entry(other), 150, passphrase),
      ColibriReactError,
    );
    await assertRejects(
      () => signer.signSorobanAuthEntry(input, 150, passphrase, other),
      ColibriReactError,
    );
    const source = new xdr.SorobanAuthorizationEntry({
      ...input,
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    });
    await assertRejects(
      () => signer.signSorobanAuthEntry(source, 150, passphrase),
      ColibriReactError,
    );
    assertEquals(calls, 1);
  });
  it("rejects modified wallet responses and propagates rejection without retry", async () => {
    const original = entry();
    for (
      const response of [
        entry(other, 7n, 150),
        entry(account, 8n, 150),
        entry(account, 7n, 151),
        new xdr.SorobanAuthorizationEntry({
          ...original,
          credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
        }),
      ]
    ) {
      const signer = createWalletAuthEntrySigner({
        address: account,
        networkPassphrase: passphrase,
        signAuthEntry: () => Promise.resolve(response.toXdr("base64")),
      });
      await assertRejects(
        () => signer.signSorobanAuthEntry(original, 150, passphrase),
        ColibriReactError,
      );
    }
    const rejected = new Error("wallet declined");
    let calls = 0;
    const signer = createWalletAuthEntrySigner({
      address: account,
      networkPassphrase: passphrase,
      signAuthEntry: () => {
        calls++;
        return Promise.reject(rejected);
      },
    });
    assertStrictEquals(
      await assertRejects(() =>
        signer.signSorobanAuthEntry(original, 150, passphrase)
      ),
      rejected,
    );
    assertEquals(calls, 1);
    assertThrows(
      () =>
        createWalletAuthEntrySigner({
          address: "G-invalid",
          networkPassphrase: passphrase,
          signAuthEntry: () => Promise.resolve(""),
        }),
      ColibriReactError,
    );
  });
});
