import { assert, assertEquals, assertRejects } from "@std/assert";
import { stub } from "@std/testing/mock"; // Add this import
import { describe, it } from "@std/testing/bdd";
import { muxedAddressToBaseAccount } from "./index.ts";

import * as E from "./error.ts";
import type { MuxedAddress } from "../../../common/types.ts";
import { isEd25519PublicKey } from "../../../common/verifiers/is-ed25519-public-key.ts";
import { MuxedAccount } from "stellar-sdk";


describe("Transformer muxedAddressToBaseAccount", () => {
  it("converts a valid muxed address to a valid Ed25519 Public Key", async () => {
    assert(
      isEd25519PublicKey(
        await muxedAddressToBaseAccount(
          "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWDOAWUHEJP5MVZQYI"
        )
      )
    );
  });

  it("converts a valid muxed address to the base account's Ed25519 Public Key", async () => {
    assertEquals(
      await muxedAddressToBaseAccount(
        "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWDOAWUHEJP5MVZQYI"
      ),
      "GCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G7"
    );

    assertEquals(
      await muxedAddressToBaseAccount(
        "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWAAAAAAAAAAAAGQLS"
      ),
      "GCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G7"
    );

    assertEquals(
      await muxedAddressToBaseAccount(
        "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWAAAAAAAAAAAALBYS"
      ),
      "GCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUW4G7"
    );

    assertEquals(
      await muxedAddressToBaseAccount(
        "MDDRMORMBDFJF72CI2FUJUAYZ5M2N6TMTCJRUJEFPOGWOJQCSNW7YAAAAAAAAAAAAEMHA"
      ),
      "GDDRMORMBDFJF72CI2FUJUAYZ5M2N6TMTCJRUJEFPOGWOJQCSNW7ZY57"
    );

    assertEquals(
      await muxedAddressToBaseAccount(
        "MDDRMORMBDFJF72CI2FUJUAYZ5M2N6TMTCJRUJEFPOGWOJQCSNW7YAAAAAAA35RBPJD6E"
      ),
      "GDDRMORMBDFJF72CI2FUJUAYZ5M2N6TMTCJRUJEFPOGWOJQCSNW7ZY57"
    );

    assertEquals(
      await muxedAddressToBaseAccount(
        "MD5DZVIWMWVE5CYJ23G2BJROTJJUEBTBNIIO37QXEOIX5VCS32EZOAAAAAAAAAAAAFK56"
      ),
      "GD5DZVIWMWVE5CYJ23G2BJROTJJUEBTBNIIO37QXEOIX5VCS32EZOHUT"
    );

    assertEquals(
      await muxedAddressToBaseAccount(
        "MD5DZVIWMWVE5CYJ23G2BJROTJJUEBTBNIIO37QXEOIX5VCS32EZOAAAAAAAAAAAPOEAA"
      ),
      "GD5DZVIWMWVE5CYJ23G2BJROTJJUEBTBNIIO37QXEOIX5VCS32EZOHUT"
    );
  });

  it(" throws INVALID_MUXED_ADDRESS if the provided address isn't a valid Muxed address", async () => {
    const faultyMuxedAddress = "ABC" as unknown as MuxedAddress; // Force faulty type

    await assertRejects(
      async () => await muxedAddressToBaseAccount(faultyMuxedAddress),
      E.INVALID_MUXED_ADDRESS
    );
  });

  it(" throws FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS if the MuxedAccount cannot be loaded from the provided address", async () => {
    // This is a valid muxed address format, but it doesn't correspond to a real muxed account
    const faultyMuxedAddress =
      "MDDRMORMBDFJF72CI2FUJUAYZ5M2N6TMTCJRUJEFPOGWOJQCSNW7YAAAAAAAAAAAAEMHB" as unknown as MuxedAddress; // Force faulty type

    await assertRejects(
      async () => await muxedAddressToBaseAccount(faultyMuxedAddress),
      E.FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS
    );
  });
  it(" throws FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID if the base account ID cannot be retrieved from the muxed account", async () => {
    const validMuxedAddress = "MCOMD7XJTA3JMRH3I4WQP4RUMS7VWFSW6GBM2R7COWGFBPEWNVRUWDOAWUHEJP5MVZQYI";

    // Mock MuxedAccount.fromAddress to return a fake instance
    const mockMuxedAccount = {
      baseAccount: () => ({
        accountId: () => {
          throw new Error("Simulated accountId failure");  // Force the throw
        }
      })
    };

    // deno-lint-ignore no-unused-vars
    using fromAddressStub = stub(MuxedAccount, "fromAddress", () => mockMuxedAccount as unknown as MuxedAccount);

    await assertRejects(
      async () => await muxedAddressToBaseAccount(validMuxedAddress),
      E.FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID
    );
  });

});