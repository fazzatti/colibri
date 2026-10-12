import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  StrKey,
} from "@colibri/core";
import { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { ChannelAccounts } from "@/tools/channel-accounts.ts";
import { resolveCloseSigners } from "@/tools/close-signers.ts";
import * as ERROR from "@/shared/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const account = () =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("Channel closing concurrency", () => {
  it("bounds local lookups, preserves input order and retains original signers", async () => {
    const channels = Array.from({ length: 4 }, account);
    const sponsor = account();
    const gates = channels.map(() => Promise.withResolvers<void>());
    const started: number[] = [];
    let active = 0;
    let peak = 0;
    const rpc = {
      async getAccountEntry(address: string) {
        const index = channels.findIndex((channel) =>
          channel.address() === address
        );
        started.push(index);
        active++;
        peak = Math.max(peak, active);
        await gates[index].promise;
        active--;
        return { signers: [] };
      },
    } as unknown as Server;
    const result = resolveCloseSigners(
      rpc,
      sponsor,
      sponsor.signer(),
      channels,
      2,
    );
    await turn();
    assertEquals(started, [0, 1]);
    gates[1].resolve();
    await turn();
    assertEquals(started, [0, 1, 2]);
    gates[2].resolve();
    await turn();
    assertEquals(started, [0, 1, 2, 3]);
    gates[3].resolve();
    gates[0].resolve();
    const signers = await result;
    for (const [index, channel] of channels.entries()) {
      assertStrictEquals(signers[index], channel.signer());
    }
    assertEquals(peak, 2);
    assertEquals(active, 0);
  });

  it("preserves sponsor proxy signing for eligible channels", async () => {
    const channel = account();
    const sponsor = account();
    const rpc = {
      getAccountEntry() {
        return Promise.resolve({
          signers: [
            new xdr.Signer({
              weight: 1,
              key: xdr.SignerKey.signerKeyTypeEd25519(
                StrKey.decodeEd25519PublicKey(sponsor.address()),
              ),
            }),
          ],
        });
      },
    } as unknown as Server;
    const [signer] = await resolveCloseSigners(rpc, sponsor, sponsor.signer(), [
      channel,
    ], 1);
    assertEquals(signer.publicKey(), channel.address());
    assertEquals(signer.signsFor(channel.address()), true);
  });

  it("reports the first real failure before other read-only lookups finish", async () => {
    const sponsor = account();
    const channels = [account(), account(), account()];
    const gates = channels.map(() => Promise.withResolvers<void>());
    const expected = new ERROR.MISSING_ARG("first failure");
    let finished = 0;
    const rpc = {
      async getAccountEntry(address: string) {
        const index = channels.findIndex((channel) =>
          channel.address() === address
        );
        await gates[index].promise;
        finished++;
        if (index === 1) throw expected;
        if (index === 2) throw new Error("later failure is observed");
        return { signers: [] };
      },
    } as unknown as Server;
    const rejected = assertRejects(() =>
      resolveCloseSigners(rpc, sponsor, sponsor.signer(), channels, 3)
    );
    await turn();
    gates[1].resolve();
    assertStrictEquals(await rejected, expected);
    assertEquals(finished, 1);
    gates[0].resolve();
    gates[2].resolve();
    await turn();
    assertEquals(finished, 3);
  });

  it("validates capacity before lookup work, including empty channel lists", async () => {
    const sponsor = account();
    for (
      const concurrency of [
        0,
        -1,
        0.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ]
    ) {
      const error = await assertRejects(() =>
        ChannelAccounts.close({
          channels: [],
          sponsor,
          concurrency,
          networkConfig: NetworkConfig.TestNet(),
          config: {
            source: sponsor.address(),
            signers: [sponsor.signer()],
            fee: "100",
            timeout: 30,
          },
        }), ERROR.INVALID_CONCURRENCY);
      assertEquals(error.code, ERROR.Code.INVALID_CONCURRENCY);
      assertEquals(error.meta?.data, { concurrency });
    }
  });
});
