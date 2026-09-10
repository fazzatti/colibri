import { assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError, StrKey } from "@colibri/core";
import { ColibriError as GranularError } from "@colibri/core/errors";
import { StrKey as GranularStrKey } from "@colibri/core/strkey";
import { Code, type ERROR_HLP_UNT } from "@/common/helpers/format-units.error.ts";

describe("granular public entrypoints", () => {
  it("shares root implementations without wrapping their constructors", () => {
    assertStrictEquals(ColibriError, GranularError);
    assertStrictEquals(StrKey, GranularStrKey);
  });
  it("preserves enum-member registry keys for typed consumers", () => {
    const enumKey = (key: keyof typeof ERROR_HLP_UNT): Code => key;
    assertStrictEquals(enumKey(Code.INVALID_DECIMALS), Code.INVALID_DECIMALS);
  });
});
