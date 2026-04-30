import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertNotStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { Keypair, xdr } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import {
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  normalizeBinaryData,
  type Signer,
  StrKey,
} from "@colibri/core";
import type { ChannelAccount } from "@/shared/types.ts";
import {
  chunkChannels,
  createChannelAccount,
  createChannelProxySigner,
  createClassicPipelineArgs,
  resolveRpc,
  sponsorCanSignChannel,
} from "@/tools/helpers.ts";

const sponsor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const channel = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

describe("ChannelAccounts helpers", () => {
  it("creates classic pipeline args with and without an rpc override", () => {
    const networkConfig = NetworkConfig.TestNet();
    const rpc = new Server("https://override.example.com");

    assertEquals(createClassicPipelineArgs({ networkConfig, rpc }), {
      networkConfig,
      rpc,
    });
    assertEquals(createClassicPipelineArgs({ networkConfig }), {
      networkConfig,
    });
  });

  it("resolves the provided rpc or creates a new one from network config", () => {
    const networkConfig = NetworkConfig.TestNet();
    const providedRpc = new Server("https://override.example.com");

    assertEquals(resolveRpc({ networkConfig, rpc: providedRpc }), providedRpc);

    const resolvedRpc = resolveRpc({ networkConfig });
    assertInstanceOf(resolvedRpc, Server);
    assertNotStrictEquals(resolvedRpc, providedRpc);
  });

  it("creates a fresh channel account paired with its master signer", () => {
    const created = createChannelAccount();

    assertEquals(created.signer().publicKey(), created.address());
    assert(created.address().startsWith("G"));
  });

  it("detects when the sponsor can sign for a channel", async () => {
    const rpc = {
      getAccountEntry() {
        return Promise.resolve({
          signers() {
            return [{
              weight: () => 1,
              key: () => ({
                ed25519: () => StrKey.decodeEd25519PublicKey(sponsor.address()),
              }),
            }];
          },
        });
      },
    } as unknown as Server;

    assertEquals(await sponsorCanSignChannel(rpc, sponsor, channel), true);
  });

  it("ignores malformed signer entries when checking sponsor authority", async () => {
    const rpc = {
      getAccountEntry() {
        return Promise.resolve({
          signers() {
            return [{
              weight: () => 1,
              key: () => {
                throw new Error("bad signer");
              },
            }];
          },
        });
      },
    } as unknown as Server;

    assertEquals(await sponsorCanSignChannel(rpc, sponsor, channel), false);
  });

  it("proxies signer capabilities for channel-scoped signing", async () => {
    const calls = {
      sign: 0,
      signTransaction: 0,
      signSorobanAuthEntry: 0,
    };
    const fakeSigner: Signer = {
      publicKey: () => sponsor.address(),
      sign: (data) => {
        calls.sign += 1;
        return Buffer.from(normalizeBinaryData(data));
      },
      signTransaction: () => {
        calls.signTransaction += 1;
        return "signed-xdr";
      },
      signSorobanAuthEntry: (entry) => {
        calls.signSorobanAuthEntry += 1;
        return Promise.resolve(entry);
      },
      signsFor: () => true,
    };

    const proxySigner = createChannelProxySigner(fakeSigner, channel);
    const forwardedData = Buffer.from("payload");
    const sorobanEntry = {} as xdr.SorobanAuthorizationEntry;
    const transactionXdr = await proxySigner.signTransaction({
      signatures: [],
      toXDR: () => "fresh-xdr",
    } as never);

    assertEquals(proxySigner.publicKey(), channel.address());
    assertEquals(proxySigner.sign(forwardedData), forwardedData);
    assertEquals(
      await proxySigner.signSorobanAuthEntry(sorobanEntry, 123, "testnet"),
      sorobanEntry,
    );
    assertEquals(proxySigner.signsFor(channel.address()), true);
    assertEquals(proxySigner.signsFor(sponsor.address()), false);
    assertEquals(transactionXdr, "signed-xdr");
    assertEquals(calls.sign, 1);
    assertEquals(calls.signTransaction, 1);
    assertEquals(calls.signSorobanAuthEntry, 1);
  });

  it("reuses the existing transaction xdr when the proxy signer hint is already present", async () => {
    const signerHint = Keypair.fromPublicKey(sponsor.address()).signatureHint();
    const fakeSigner: Signer = {
      publicKey: () => sponsor.address(),
      sign: (data) => data,
      signTransaction: () => {
        throw new Error("should not sign twice");
      },
      signSorobanAuthEntry: (entry) => Promise.resolve(entry),
      signsFor: () => true,
    };

    const proxySigner = createChannelProxySigner(fakeSigner, channel);
    const signedTransactionXdr = await proxySigner.signTransaction({
      signatures: [
        new xdr.DecoratedSignature({
          hint: signerHint,
          signature: Buffer.from("already-signed"),
        }),
      ],
      toXDR: () => "already-signed-xdr",
    } as never);

    assertEquals(signedTransactionXdr, "already-signed-xdr");
  });

  it("chunks channels into bounded batches", () => {
    const otherChannel = createChannelAccount();

    assertEquals(
      chunkChannels([sponsor, channel, otherChannel] as ChannelAccount[], 2)
        .map((
          batch,
        ) => batch.length),
      [2, 1],
    );
  });
});
