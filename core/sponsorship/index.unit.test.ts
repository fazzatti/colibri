import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Account,
  Asset,
  MuxedAccount,
  Networks,
  Operation,
  TransactionBuilder,
} from "stellar-sdk";
import { LocalSigner } from "@/signer/local/index.ts";
import {
  SponsorshipErrors as E,
  wrapSponsorship,
} from "@/sponsorship/index.ts";
import type { WrapSponsorshipArgs } from "@/sponsorship/types.ts";
import type { MuxedAddress } from "@/strkeys/types.ts";

describe("wrapSponsorship", () => {
  const sponsor = LocalSigner.generateRandom().publicKey();
  const sponsored = LocalSigner.generateRandom().publicKey();
  const other = LocalSigner.generateRandom().publicKey();

  it("preserves native operations, sources, array contents and order", () => {
    const operations = Object.freeze([
      Operation.changeTrust({
        source: sponsored,
        asset: new Asset("USD", other),
      }),
      Operation.manageData({ name: "note", value: "source is inherited" }),
      Operation.manageData({
        source: other,
        name: "other",
        value: "unchanged",
      }),
    ]);
    const before = operations.map((op) => op.toXdr("base64"));
    const result = wrapSponsorship({ sponsor, sponsored, operations });
    assertEquals(result.length, 5);
    for (let i = 0; i < operations.length; i++) {
      assertStrictEquals(result[i + 1], operations[i]);
    }
    assertEquals(operations.map((op) => op.toXdr("base64")), before);
    const tx = new TransactionBuilder(new Account(sponsor, "0"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(result[0]).addOperation(result[1]).addOperation(result[2])
      .addOperation(result[3]).addOperation(result[4]).setTimeout(60).build();
    assertEquals(tx.operations[0], {
      type: "beginSponsoringFutureReserves",
      source: sponsor,
      sponsoredId: sponsored,
    });
    assertEquals(tx.operations[4], {
      type: "endSponsoringFutureReserves",
      source: sponsored,
    });
    assertEquals(tx.operations[2].source, undefined);
    assertEquals(tx.operations[3].source, other);
    assertEquals(tx.fee, "500");
  });

  it("retains a muxed sponsor and supports an empty native block", () => {
    const muxed = new MuxedAccount(new Account(sponsor, "0"), "29")
      .accountId() as MuxedAddress;
    const result = wrapSponsorship({
      sponsor: muxed,
      sponsored,
      operations: [],
    });
    assertEquals(Operation.fromXdrObject(result[0]).source, muxed);
    assertEquals(result.length, 2);
  });

  it("reports distinct invalid sponsor and sponsored-account errors", () => {
    const args: WrapSponsorshipArgs = { sponsor, sponsored, operations: [] };
    const invalidSponsor = assertThrows(
      () => wrapSponsorship({ ...args, sponsor: "Ginvalid" }),
      E.INVALID_SPONSOR,
    );
    assertEquals(invalidSponsor.code, E.Code.INVALID_SPONSOR);
    const muxed = new MuxedAccount(new Account(sponsored, "0"), "1")
      .accountId();
    const invalidSponsored = assertThrows(
      () => wrapSponsorship({ ...args, sponsored: muxed as typeof sponsored }),
      E.INVALID_SPONSORED_ACCOUNT,
    );
    assertEquals(invalidSponsored.code, E.Code.INVALID_SPONSORED_ACCOUNT);
    assertStrictEquals(E.ERROR_SPNS[invalidSponsor.code], E.INVALID_SPONSOR);
    assertStrictEquals(
      E.ERROR_SPNS[invalidSponsored.code],
      E.INVALID_SPONSORED_ACCOUNT,
    );
  });
});
