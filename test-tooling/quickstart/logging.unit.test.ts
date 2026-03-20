import { assertStrictEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import { createLogger, LogLevel, type LoggerLike } from "@/quickstart/logging.ts";

Deno.test("createLogger returns the provided logger unchanged", () => {
  const logger: LoggerLike = {
    error: () => undefined,
    warn: () => undefined,
    info: () => undefined,
    debug: () => undefined,
    trace: () => undefined,
  };

  assertStrictEquals(
    createLogger({ label: "custom", level: "info", logger }),
    logger
  );
});

Deno.test("console logger honors numeric log levels and prefixes messages", () => {
  const debugStub = stub(console, "debug");
  const infoStub = stub(console, "info");
  const warnStub = stub(console, "warn");
  const errorStub = stub(console, "error");

  try {
    const logger = createLogger({ label: "unit", level: LogLevel.DEBUG });

    logger.trace("trace");
    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    assertSpyCalls(debugStub, 1);
    assertSpyCalls(infoStub, 1);
    assertSpyCalls(warnStub, 1);
    assertSpyCalls(errorStub, 1);

    const debugPrefix = debugStub.calls[0].args[0] as string;
    const infoPrefix = infoStub.calls[0].args[0] as string;
    const warnPrefix = warnStub.calls[0].args[0] as string;
    const errorPrefix = errorStub.calls[0].args[0] as string;

    assertStrictEquals(debugPrefix.includes("DEBUG (unit):"), true);
    assertStrictEquals(infoPrefix.includes("INFO (unit):"), true);
    assertStrictEquals(warnPrefix.includes("WARN (unit):"), true);
    assertStrictEquals(errorPrefix.includes("ERROR (unit):"), true);
  } finally {
    debugStub.restore();
    infoStub.restore();
    warnStub.restore();
    errorStub.restore();
  }
});

Deno.test("console logger falls back to warn on unknown levels", () => {
  const debugStub = stub(console, "debug");
  const infoStub = stub(console, "info");
  const warnStub = stub(console, "warn");

  try {
    const logger = createLogger({
      label: "fallback",
      level: "LOUD" as never,
    });

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");

    assertSpyCalls(debugStub, 0);
    assertSpyCalls(infoStub, 0);
    assertSpyCalls(warnStub, 1);
  } finally {
    debugStub.restore();
    infoStub.restore();
    warnStub.restore();
  }
});

Deno.test("console logger accepts string levels and trace logs use console.debug", () => {
  const debugStub = stub(console, "debug");
  const infoStub = stub(console, "info");
  const warnStub = stub(console, "warn");
  const errorStub = stub(console, "error");

  try {
    const logger = createLogger({ label: "trace", level: "TRACE" });

    logger.trace("trace");
    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    assertSpyCalls(debugStub, 2);
    assertSpyCalls(infoStub, 1);
    assertSpyCalls(warnStub, 1);
    assertSpyCalls(errorStub, 1);

    const tracePrefix = debugStub.calls[0].args[0] as string;
    assertStrictEquals(tracePrefix.includes("TRACE (trace):"), true);
  } finally {
    debugStub.restore();
    infoStub.restore();
    warnStub.restore();
    errorStub.restore();
  }
});
