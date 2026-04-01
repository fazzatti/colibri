import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertStrictEquals,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Code,
  CONTAINER_ERROR,
  DOCKER_CONFIGURATION_ERROR,
  ERROR_TTO_QKS,
  IMAGE_ERROR,
  INVALID_CONFIGURATION,
  QuickstartError,
  READINESS_ERROR,
} from "@/quickstart/error.ts";

describe("Quickstart errors", () => {
  it("quickstart errors expose consistent metadata", () => {
    const error = new INVALID_CONFIGURATION({
      option: "network",
      value: "testnet",
      supportedValues: ["local"],
      message: "Invalid network option.",
      details: "Only local ledgers are supported.",
    });

    assertInstanceOf(error, QuickstartError);
    assertStrictEquals(error.domain, "tools");
    assertStrictEquals(error.source, "@colibri/test-tooling/quickstart");
    assertStrictEquals(error.code, Code.INVALID_CONFIGURATION);
    assertEquals(error.meta, {
      cause: null,
      data: {
        option: "network",
        value: "testnet",
        supportedValues: ["local"],
      },
    });
  });

  it("quickstart errors serialize to JSON", () => {
    class TEST_ERROR extends QuickstartError<"TEST_ERROR", { option: string }> {
      constructor() {
        super({
          code: "TEST_ERROR",
          message: "Invalid network option.",
          details: "Only local ledgers are supported.",
          diagnostic: {
            rootCause: "Unsupported network profile.",
            suggestion: "Use the local quickstart network.",
            materials: ["https://example.com/quickstart"],
          },
          data: {
            option: "network",
          },
        });
      }
    }

    const error = new TEST_ERROR();

    assertEquals(error.toJSON(), {
      name: "QuickstartError TEST_ERROR",
      domain: "tools",
      code: "TEST_ERROR",
      message: "Invalid network option.",
      source: "@colibri/test-tooling/quickstart",
      details: "Only local ledgers are supported.",
      diagnostic: {
        rootCause: "Unsupported network profile.",
        suggestion: "Use the local quickstart network.",
        materials: ["https://example.com/quickstart"],
      },
      meta: {
        cause: null,
        data: {
          option: "network",
        },
      },
    });
  });

  it("quickstart errors serialize causes as plain JSON-safe objects", () => {
    const error = new DOCKER_CONFIGURATION_ERROR({
      message: "Docker config failed.",
      details: "Bad socket.",
      cause: new Error("boom"),
    });

    const serialized = error.toJSON() as {
      meta: {
        cause: { name: string; message: string; stack?: string } | null;
      };
    };

    assertStrictEquals(serialized.meta.cause?.name, "Error");
    assertStrictEquals(serialized.meta.cause?.message, "boom");
    assertExists(serialized.meta.cause?.stack);
    assertEquals(typeof serialized.meta.cause?.stack, "string");
  });

  it("quickstart errors normalize Error, string, and object causes", () => {
    const dockerError = new DOCKER_CONFIGURATION_ERROR({
      message: "Docker config failed.",
      details: "Bad socket.",
      cause: new Error("boom"),
    });
    assertStrictEquals(dockerError.meta.cause?.message, "boom");
    assertEquals(dockerError.meta.data, {});

    const containerError = new CONTAINER_ERROR({
      message: "Container failed.",
      details: "Could not inspect the container.",
      cause: "broken",
      data: { containerId: "abc" },
    });
    assertStrictEquals(containerError.meta.cause?.message, "broken");
    assertEquals(containerError.meta.data, { containerId: "abc" });

    const imageError = new IMAGE_ERROR({
      message: "Image pull failed.",
      details: "The daemon rejected the request.",
      cause: { status: "bad" },
    });
    assertStrictEquals(imageError.meta.cause?.message, '{"status":"bad"}');
    assertEquals(imageError.meta.data, {});

    const circularCause: { label: string; self?: unknown; toString(): string } =
      {
        label: "circular",
        toString() {
          return "circular-cause";
        },
      };
    circularCause.self = circularCause;

    const fallbackCauseError = new IMAGE_ERROR({
      message: "Image pull failed.",
      details: "The daemon rejected the request.",
      cause: circularCause,
    });
    assertStrictEquals(
      fallbackCauseError.meta.cause?.message,
      "circular-cause",
    );
    assertEquals(fallbackCauseError.meta.data, {});
  });

  it("readiness errors include custom payload data", () => {
    const error = new READINESS_ERROR({
      message: "Timed out.",
      details: "The ledger never became healthy.",
      data: {
        containerId: "ledger",
        timeoutMs: 1000,
      },
    });

    assertStrictEquals(error.code, Code.READINESS_ERROR);
    assertEquals(error.meta.data, {
      containerId: "ledger",
      timeoutMs: 1000,
    });

    const emptyDataError = new READINESS_ERROR({
      message: "Still waiting.",
      details: "No payload provided.",
    });
    assertEquals(emptyDataError.meta.data, {});
  });

  it("ERROR_TTO_QKS exposes the quickstart error registry", () => {
    assertStrictEquals(
      ERROR_TTO_QKS[Code.INVALID_CONFIGURATION],
      INVALID_CONFIGURATION,
    );
    assertStrictEquals(
      ERROR_TTO_QKS[Code.DOCKER_CONFIGURATION_ERROR],
      DOCKER_CONFIGURATION_ERROR,
    );
    assertStrictEquals(ERROR_TTO_QKS[Code.CONTAINER_ERROR], CONTAINER_ERROR);
    assertStrictEquals(ERROR_TTO_QKS[Code.IMAGE_ERROR], IMAGE_ERROR);
    assertStrictEquals(ERROR_TTO_QKS[Code.READINESS_ERROR], READINESS_ERROR);
  });
});
