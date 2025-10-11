import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Address } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";

import { SignAuthEntries } from "./index.ts";
import { TestNet } from "../../network/index.ts";

import { Buffer } from "node:buffer";
import type { TransactionSigner } from "../../signer/types.ts";
import type { Ed25519PublicKey } from "../../strkeys/types.ts";

type MockSigner = TransactionSigner & {
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

const makeScAddressAuthEntry = (address: xdr.ScAddress) =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address,
        nonce: new xdr.Int64(0),
        signatureExpirationLedger: 0,
        signature: xdr.ScVal.scvVec([]),
      })
    ),
    rootInvocation: makeInvocation(),
  });

const makeSourceAuthEntry = () =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: makeInvocation(),
  });

const makeContractAuthEntry = () =>
  new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.contract(Buffer.alloc(32, 9)).toScAddress(),
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
  const sign: TransactionSigner["sign"] = async (
    ..._args: Parameters<TransactionSigner["sign"]>
  ) => {
    return await Promise.resolve(
      undefined as unknown as Awaited<ReturnType<TransactionSigner["sign"]>>
    );
  };

  const signer: MockSigner = {
    calls: 0,
    publicKey: () => publicKey as Ed25519PublicKey,
    sign,
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

describe("SignAuthEntries", () => {
  const { networkPassphrase } = TestNet();

  it("signs a single account entry", async () => {
    const account = Address.account(Buffer.alloc(32, 1));
    const entry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());
    const rpc = makeRpc();

    const out = await SignAuthEntries.run({
      auth: [entry],
      signers: [signer],
      rpc,
      networkPassphrase,
    });

    assertEquals(out.length, 1);
    assertEquals(signer.calls, 1);
    assertEquals(signer.lastValidUntil, 1120);
  });

  it("signs multiple entries with matching signers only", async () => {
    const account1 = Address.account(Buffer.alloc(32, 1));
    const account2 = Address.account(Buffer.alloc(32, 2));
    const entry1 = makeAccountAuthEntry(account1);
    const entry2 = makeAccountAuthEntry(account2);
    const signer1 = makeSigner(account1.toString());
    const signer2 = makeSigner(account2.toString());

    const out = await SignAuthEntries.run({
      auth: [entry1, entry2],
      signers: [signer1, signer2],
      rpc: makeRpc(),
      networkPassphrase,
    });

    assertEquals(out.length, 2);
    assertEquals(signer1.calls, 1);
    assertEquals(signer2.calls, 1);
  });

  it("uses provided validUntilLedgerSeq", async () => {
    const account = Address.account(Buffer.alloc(32, 3));
    const entry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());

    await SignAuthEntries.run({
      auth: [entry],
      signers: [signer],
      rpc: makeRpc(),
      networkPassphrase,
      validity: { validUntilLedgerSeq: 5000 },
    });

    assertEquals(signer.lastValidUntil, 5000);
  });

  it("derives validUntilLedgerSeq from validForLedgers", async () => {
    const account = Address.account(Buffer.alloc(32, 4));
    const entry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());

    await SignAuthEntries.run({
      auth: [entry],
      signers: [signer],
      rpc: makeRpc(2000),
      networkPassphrase,
      validity: { validForLedgers: 10 },
    });

    assertEquals(signer.lastValidUntil, 2010);
  });

  it("derives validUntilLedgerSeq from validForSeconds", async () => {
    const account = Address.account(Buffer.alloc(32, 5));
    const entry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());

    await SignAuthEntries.run({
      auth: [entry],
      signers: [signer],
      rpc: makeRpc(3000),
      networkPassphrase,
      validity: { validForSeconds: 55 },
    });

    assertEquals(signer.lastValidUntil, 3011);
  });

  it("returns source entries when includeUnsigned is true", async () => {
    const account = Address.account(Buffer.alloc(32, 6));
    const sourceEntry = makeSourceAuthEntry();
    const accountEntry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());

    const out = await SignAuthEntries.run({
      auth: [sourceEntry, accountEntry],
      signers: [signer],
      rpc: makeRpc(),
      networkPassphrase,
      includeUnsigned: true,
    });

    assertEquals(out.length, 2);
    assertEquals(signer.calls, 1);
  });

  it("omits source entries when includeUnsigned is false", async () => {
    const account = Address.account(Buffer.alloc(32, 7));
    const sourceEntry = makeSourceAuthEntry();
    const accountEntry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());

    const out = await SignAuthEntries.run({
      auth: [sourceEntry, accountEntry],
      signers: [signer],
      rpc: makeRpc(),
      networkPassphrase,
      includeUnsigned: false,
    });

    assertEquals(out.length, 1);
    assertEquals(signer.calls, 1);
  });

  it("passes through unsupported entries only when includeUnsigned is true", async () => {
    const account = Address.account(Buffer.alloc(32, 8));
    const contractEntry = makeContractAuthEntry();
    const accountEntry = makeAccountAuthEntry(account);
    const signer = makeSigner(account.toString());

    const out = await SignAuthEntries.run({
      auth: [contractEntry, accountEntry],
      signers: [signer],
      rpc: makeRpc(),
      networkPassphrase,
      includeUnsigned: true,
    });

    assertEquals(out.length, 2);
    assertEquals(signer.calls, 1);
  });

  it("passes through special address types when includeUnsigned is true", async () => {
    const claimable = makeScAddressAuthEntry(
      xdr.ScAddress.scAddressTypeClaimableBalance(
        xdr.ClaimableBalanceId.claimableBalanceIdTypeV0(Buffer.alloc(32, 21))
      )
    );
    const liquidity = makeScAddressAuthEntry(
      xdr.ScAddress.scAddressTypeLiquidityPool(
        Buffer.alloc(32, 22) as unknown as xdr.PoolId
      )
    );
    const muxed = makeScAddressAuthEntry(
      xdr.ScAddress.scAddressTypeMuxedAccount(
        new xdr.MuxedEd25519Account({
          id: new xdr.Uint64(123),
          ed25519: Buffer.alloc(32, 23),
        })
      )
    );
    const signer = makeSigner(Address.account(Buffer.alloc(32, 24)).toString());

    const out = await SignAuthEntries.run({
      auth: [claimable, liquidity, muxed],
      signers: [signer],
      rpc: makeRpc(),
      networkPassphrase,
      includeUnsigned: true,
    });

    assertEquals(out.length, 3);
    assertEquals(signer.calls, 0);
  });

  it("omits special address types when includeUnsigned is false", async () => {
    const claimable = makeScAddressAuthEntry(
      xdr.ScAddress.scAddressTypeClaimableBalance(
        xdr.ClaimableBalanceId.claimableBalanceIdTypeV0(Buffer.alloc(32, 25))
      )
    );
    const liquidity = makeScAddressAuthEntry(
      xdr.ScAddress.scAddressTypeLiquidityPool(
        Buffer.alloc(32, 26) as unknown as xdr.PoolId
      )
    );
    const muxed = makeScAddressAuthEntry(
      xdr.ScAddress.scAddressTypeMuxedAccount(
        new xdr.MuxedEd25519Account({
          id: new xdr.Uint64(123),
          ed25519: Buffer.alloc(32, 23),
        })
      )
    );
    const signer = makeSigner(Address.account(Buffer.alloc(32, 28)).toString());

    const out = await SignAuthEntries.run({
      auth: [claimable, liquidity, muxed],
      signers: [signer],
      rpc: makeRpc(),
      networkPassphrase,
      includeUnsigned: false,
    });

    assertEquals(out.length, 0);
    assertEquals(signer.calls, 0);
  });
});
