import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { ColibriError, GeneralCode, UnexpectedError } from "@/error/index.ts";
import { UNEXPECTED_ERROR as ContractUnexpectedError } from "@/contract/error.ts";
import { UNEXPECTED_ERROR as AssetUnexpectedError } from "@/asset/sac/error.ts";
import { errorContext } from "@/common/helpers/error-context.ts";
import { IsFalsyError } from "@/common/helpers/boolean.ts";

const { describe, it } = recordColibriTests(import.meta.url);
describe("Core concrete error compatibility", () => {
  it("keeps family identity, consumer extension points, fallback and reserved codes", () => {
    const cause = new Error("failure");
    for (
      const error of [
        new ContractUnexpectedError(cause),
        new AssetUnexpectedError(cause),
      ]
    ) {
      assert(error instanceof ColibriError);
      assertStrictEquals(error.meta.cause, cause);
    }
    assertEquals(new ContractUnexpectedError(cause).code, "CONTR_000");
    assertEquals(new AssetUnexpectedError(cause).code, "SAC_000");
    assert(ColibriError.unexpected() instanceof UnexpectedError);
    assert(
      ColibriError.unexpected({ code: GeneralCode.UNEXPECTED }) instanceof
        UnexpectedError,
    );
    assert(
      ColibriError.fromUnknown(cause, {
        code: GeneralCode.UNEXPECTED,
      }) instanceof UnexpectedError,
    );
    assertEquals(
      ColibriError.fromUnknown(cause, { code: "CONSUMER_1" }).code,
      "CONSUMER_1",
    );
    assertEquals(ColibriError.unexpected({ code: "" }).code, "");
    assertEquals(ColibriError.fromUnknown(cause, { code: "" }).code, "");
    const original = new IsFalsyError({
      domain: "helpers",
      source: "test",
      message: "failure",
    });
    assertStrictEquals(ColibriError.fromUnknown(original), original);
    assertEquals(original.details, "An unexpected error occurred");
    assertEquals(original.meta, { cause: undefined });
  });
  it("retains native and non-Error causes and exact supplied diagnostics", () => {
    const cause = new Error("native");
    assertEquals(errorContext(cause, {}).message, "native");
    assertEquals(errorContext(cause, {}).details, cause.stack);
    const context = errorContext(17, {});
    assertEquals(context.message, "Unexpected error");
    assertEquals(context.details, "An unexpected error occurred");
    assertEquals(context.meta?.cause, 17);
    const diagnostic = { rootCause: "cause", suggestion: "fix" };
    const result = errorContext(cause, {
      details: "custom",
      diagnostic,
      meta: { data: 1 },
    });
    assertEquals(result.details, "custom");
    assertStrictEquals(result.diagnostic, diagnostic);
    assertStrictEquals(result.meta?.cause, cause);
    assertEquals(result.meta?.data, 1);
    assertEquals(
      new IsFalsyError({ ...result, details: undefined }).details,
      undefined,
    );
  });
});
