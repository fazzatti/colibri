import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { nativeToScVal } from "stellar-sdk";
import { decodeTokenValue } from "@/asset/token-value.ts";
import { MISSING_RETURN_VALUE as MissingSACValue } from "@/asset/sac/error.ts";
import { MISSING_RETURN_VALUE as MissingSEP41Value } from "@/asset/sep41-token/error.ts";
import { Method } from "@/asset/sac/types.ts";

describe("shared token result decoding", () => {
  it("preserves native zero, empty, boolean, and bigint values", () => {
    for (const value of [0n, "", false, 123n]) {
      assertEquals(
        decodeTokenValue(
          nativeToScVal(value),
          new MissingSACValue(Method.Balance),
        ),
        value,
      );
    }
  });
  it("preserves each client's error namespace", () => {
    assertThrows(
      () => decodeTokenValue(undefined, new MissingSACValue(Method.Balance)),
      MissingSACValue,
    );
    assertThrows(
      () => decodeTokenValue(undefined, new MissingSEP41Value("balance")),
      MissingSEP41Value,
    );
  });
});
