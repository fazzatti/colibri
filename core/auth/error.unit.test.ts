import { assertEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { AuthError } from "@/auth/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

class TEST_AUTH_ERROR extends AuthError<"AUTH_TEST", { authId: string }> {
  constructor(cause?: Error) {
    super({
      code: "AUTH_TEST",
      message: "Test auth error",
      data: { authId: "auth-1" },
      cause,
    });
  }
}

describe("AuthError", () => {
  it("normalizes missing causes to null", () => {
    const error = new TEST_AUTH_ERROR();

    assertEquals(error.meta.data, { authId: "auth-1" });
    assertEquals(error.meta.cause, null);
  });

  it("preserves the provided cause in metadata", () => {
    const cause = new Error("root cause");
    const error = new TEST_AUTH_ERROR(cause);

    assertEquals(error.meta.data, { authId: "auth-1" });
    assertEquals(error.meta.cause, cause);
  });
});
