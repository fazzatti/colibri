import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as E from "@/ledger-entries/error.ts";

describe("LedgerEntries errors", () => {
  it("exposes stable error codes through direct constructors", async () => {
    assertEquals(
      new E.INVALID_CONTRACT_ID("BAD").code,
      E.Code.INVALID_CONTRACT_ID,
    );
    assertEquals(
      new E.INVALID_CONFIG_SETTING_ID("badSetting").code,
      E.Code.INVALID_CONFIG_SETTING_ID,
    );
    assertEquals(
      new E.INVALID_LEDGER_KEY_HASH().code,
      E.Code.INVALID_LEDGER_KEY_HASH,
    );
    assertEquals(
      new E.UNEXPECTED_LEDGER_ENTRY_TYPE("account", "data").code,
      E.Code.UNEXPECTED_LEDGER_ENTRY_TYPE,
    );
    assertEquals(
      new E.UNSUPPORTED_RPC_LEDGER_KEY("account").code,
      E.Code.UNSUPPORTED_RPC_LEDGER_KEY,
    );

    await assertRejects(
      () =>
        Promise.reject(new E.UNEXPECTED_LEDGER_ENTRY_TYPE("account", "data")),
      E.UNEXPECTED_LEDGER_ENTRY_TYPE,
    );
  });
});
