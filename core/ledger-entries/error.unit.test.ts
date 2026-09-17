import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as ERROR from "@/ledger-entries/error.ts";

describe("LedgerEntries errors", () => {
  it("exposes stable error codes through direct constructors", async () => {
    assertEquals(
      new ERROR.INVALID_CONTRACT_ID("BAD").code,
      ERROR.Code.INVALID_CONTRACT_ID,
    );
    assertEquals(
      new ERROR.INVALID_OFFER_ID(-1).code,
      ERROR.Code.INVALID_OFFER_ID,
    );
    assertEquals(
      new ERROR.INVALID_CONFIG_SETTING_ID("badSetting").code,
      ERROR.Code.INVALID_CONFIG_SETTING_ID,
    );
    assertEquals(
      new ERROR.INVALID_LEDGER_KEY_HASH().code,
      ERROR.Code.INVALID_LEDGER_KEY_HASH,
    );
    assertEquals(
      new ERROR.UNEXPECTED_LEDGER_ENTRY_TYPE("account", "data").code,
      ERROR.Code.UNEXPECTED_LEDGER_ENTRY_TYPE,
    );
    assertEquals(
      new ERROR.UNSUPPORTED_RPC_LEDGER_KEY("account").code,
      ERROR.Code.UNSUPPORTED_RPC_LEDGER_KEY,
    );

    await assertRejects(
      () =>
        Promise.reject(
          new ERROR.UNEXPECTED_LEDGER_ENTRY_TYPE("account", "data"),
        ),
      ERROR.UNEXPECTED_LEDGER_ENTRY_TYPE,
    );
  });

  it("exposes the registry for code-based lookups", () => {
    assertEquals(
      ERROR.ERROR_LDE[ERROR.Code.INVALID_OFFER_ID],
      ERROR.INVALID_OFFER_ID,
    );
    assertEquals(
      ERROR.ERROR_LDE[ERROR.Code.UNSUPPORTED_RPC_LEDGER_KEY],
      ERROR.UNSUPPORTED_RPC_LEDGER_KEY,
    );
  });
});
