import { assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core";
import {
  CHANNEL_NOT_ALLOCATED,
  Code,
  ERROR_PLG_CHA,
  INVALID_NUMBER_OF_CHANNELS,
  MISSING_ARG,
  UNEXPECTED_ERROR,
} from "@/shared/error.ts";

describe("Channel accounts errors", () => {
  it("constructs UNEXPECTED_ERROR with the original cause", () => {
    const cause = new Error("boom");
    const error = new UNEXPECTED_ERROR(cause);

    assertInstanceOf(error, ColibriError);
    assertEquals(error.code, Code.UNEXPECTED_ERROR);
    assertEquals(error.source, "@colibri/plugin-channel-accounts");
    assertEquals(error.meta?.cause, cause);
  });

  it("constructs MISSING_ARG with the missing argument metadata", () => {
    const error = new MISSING_ARG("networkConfig");

    assertEquals(error.code, Code.MISSING_ARG);
    assertEquals(error.meta?.data, { argName: "networkConfig" });
  });

  it("constructs INVALID_NUMBER_OF_CHANNELS with bounds metadata", () => {
    const error = new INVALID_NUMBER_OF_CHANNELS(20, 1, 15);

    assertEquals(error.code, Code.INVALID_NUMBER_OF_CHANNELS);
    assertEquals(error.meta?.data, {
      numberOfChannels: 20,
      min: 1,
      max: 15,
    });
  });

  it("constructs CHANNEL_NOT_ALLOCATED with the run id metadata", () => {
    const error = new CHANNEL_NOT_ALLOCATED("run-1");

    assertEquals(error.code, Code.CHANNEL_NOT_ALLOCATED);
    assertEquals(error.meta?.data, { runId: "run-1" });
  });

  it("exports the code-to-constructor map", () => {
    assertEquals(ERROR_PLG_CHA[Code.UNEXPECTED_ERROR], UNEXPECTED_ERROR);
    assertEquals(ERROR_PLG_CHA[Code.MISSING_ARG], MISSING_ARG);
    assertEquals(
      ERROR_PLG_CHA[Code.INVALID_NUMBER_OF_CHANNELS],
      INVALID_NUMBER_OF_CHANNELS,
    );
    assertEquals(
      ERROR_PLG_CHA[Code.CHANNEL_NOT_ALLOCATED],
      CHANNEL_NOT_ALLOCATED,
    );
  });
});
