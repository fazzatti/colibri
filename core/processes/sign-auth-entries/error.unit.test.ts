import { assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Address, xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { P_SignAuthEntries } from "@/processes/sign-auth-entries/index.ts";
import * as E from "@/processes/sign-auth-entries/error.ts";
import type { SignAuthEntriesInput } from "@/processes/sign-auth-entries/types.ts";
import { NetworkConfig } from "@/network/index.ts";
import type { Signer } from "@/signer/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

describe("SignAuthEntries", () => {
  const { networkPassphrase } = NetworkConfig.TestNet();

  type MockSigner = Signer & {
    calls: number;
    lastEntry?: xdr.SorobanAuthorizationEntry;
    lastValidUntil?: number;
  };

  const makeInvocation = () =>
    new xdr.SorobanAuthorizedInvocation({
      function:
        xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
          new xdr.InvokeContractArgs({
            contractAddress: Address.contract(Buffer.alloc(32)).toScAddress(),
            functionName: "noop",
            args: [],
          })
        ),
      subInvocations: [],
    });

  const makeAccountAuthEntry = (account: Address) =>
    new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: account.toScAddress(),
          nonce: new xdr.Int64(0),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVec([]),
        })
      ),
      rootInvocation: makeInvocation(),
    });

  const makeSigner = (
    publicKey: string,
    behavior?: (
      entry: xdr.SorobanAuthorizationEntry,
      validUntil: number,
      passphrase: string
    ) => Promise<xdr.SorobanAuthorizationEntry>
  ): MockSigner => {
    const signTransaction: Signer["signTransaction"] = async (
      ..._args: Parameters<Signer["signTransaction"]>
    ) => {
      return await Promise.resolve(
        undefined as unknown as Awaited<ReturnType<Signer["signTransaction"]>>
      );
    };
    const sign: Signer["sign"] = (b: Buffer): Buffer => {
      return b;
    };

    const signer: MockSigner = {
      calls: 0,
      publicKey: () => publicKey as Ed25519PublicKey,
      sign,
      signTransaction,
      signsFor: (target: Ed25519PublicKey | string) => target === publicKey,
      async signSorobanAuthEntry(entry, validUntil, passphrase) {
        signer.calls++;
        signer.lastEntry = entry;
        signer.lastValidUntil = validUntil;
        if (behavior) return await behavior(entry, validUntil, passphrase);
        return entry;
      },
    };
    return signer;
  };

  const makeRpc = (sequence = 1000): Server =>
    ({
      async getLatestLedger() {
        return await { sequence, id: "mock", protocolVersion: 20 };
      },
    } as unknown as Server);

  const makeFailingRpc = (): Server =>
    ({
      async getLatestLedger() {
        await new Promise((_resolve, reject) => reject(new Error("rpc down")));
      },
    } as unknown as Server);

  describe("errors", () => {
    it("requires auth array", async () => {
      const signer = makeSigner(
        Address.account(Buffer.alloc(32, 9)).toString()
      );
      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: undefined as unknown as xdr.SorobanAuthorizationEntry[],
            signers: [signer],
            rpc: makeRpc(),
            networkPassphrase,
          }),
        E.MISSING_ARG
      );
    });

    it("requires rpc", async () => {
      const account = Address.account(Buffer.alloc(32, 10));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString());

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: undefined as unknown as Server,
            networkPassphrase,
          }),
        E.MISSING_ARG
      );
    });

    it("requires signers", async () => {
      const account = Address.account(Buffer.alloc(32, 11));
      const entry = makeAccountAuthEntry(account);

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: undefined as unknown as Signer[],
            rpc: makeRpc(),
            networkPassphrase,
          }),
        E.MISSING_ARG
      );
    });

    it("requires networkPassphrase", async () => {
      const account = Address.account(Buffer.alloc(32, 12));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString());

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: makeRpc(),
            networkPassphrase: undefined as unknown as string,
          }),
        E.MISSING_ARG
      );
    });

    it("validates validUntilLedgerSeq > 0", async () => {
      const account = Address.account(Buffer.alloc(32, 13));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString());

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: makeRpc(),
            networkPassphrase,
            validity: { validUntilLedgerSeq: 0 },
          }),
        E.VALID_UNTIL_LEDGER_SEQ_TOO_LOW
      );
    });

    it("validates validForLedgers > 0", async () => {
      const account = Address.account(Buffer.alloc(32, 14));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString());

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: makeRpc(),
            networkPassphrase,
            validity: { validForLedgers: 0 },
          }),
        E.VALID_FOR_LEDGERS_TOO_LOW
      );
    });

    it("validates validForSeconds > 5", async () => {
      const account = Address.account(Buffer.alloc(32, 15));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString());

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: makeRpc(),
            networkPassphrase,
            validity: { validForSeconds: 5 },
          }),
        E.VALID_FOR_SECONDS_TOO_LOW
      );
    });

    it("wraps rpc failures", async () => {
      const account = Address.account(Buffer.alloc(32, 16));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString());

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: makeFailingRpc(),
            networkPassphrase,
          }),
        E.FAILED_TO_FETCH_LATEST_LEDGER
      );
    });

    it("fails when signer is missing", async () => {
      const account = Address.account(Buffer.alloc(32, 17));
      const entry = makeAccountAuthEntry(account);

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [],
            rpc: makeRpc(),
            networkPassphrase,
          }),
        E.MISSING_SIGNER
      );
    });

    it("wraps signer errors", async () => {
      const account = Address.account(Buffer.alloc(32, 18));
      const entry = makeAccountAuthEntry(account);
      const signer = makeSigner(account.toString(), () => {
        throw new Error("boom");
      });

      await assertRejects(
        () =>
          P_SignAuthEntries().run({
            auth: [entry],
            signers: [signer],
            rpc: makeRpc(),
            networkPassphrase,
          }),
        E.FAILED_TO_SIGN_AUTH_ENTRY
      );
    });

    it("wraps unexpected errors", async () => {
      await assertRejects(
        () => P_SignAuthEntries().run(null as unknown as SignAuthEntriesInput),
        E.UNEXPECTED_ERROR
      );
    });
  });
});
