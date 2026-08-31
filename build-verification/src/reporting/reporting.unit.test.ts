import { assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TEST_LIMITS, TEST_NOW, testEvidence } from "@/testing.test.ts";
import {
  EvidenceWriteFailedError,
  LoggerFailedError,
  LogWriteFailedError,
} from "@/reporting/error.ts";
import { writeVerificationEvidence } from "@/reporting/evidence-writer.ts";
import { writeVerificationLogs } from "@/reporting/log-writer.ts";
import {
  BoundedVerificationLogCollector,
  recordVerificationLog,
} from "@/reporting/logger.ts";
import type { VerificationLogEvent } from "@/core/types/result.ts";

const event = (
  overrides: Partial<VerificationLogEvent> = {},
): VerificationLogEvent => ({
  timestamp: TEST_NOW,
  stage: "resolve-verification-target",
  level: "info",
  code: "BLDV_TEST",
  message: "test event",
  data: { safe: true },
  ...overrides,
});

describe("verification reporting", () => {
  it("collects an immutable bounded event sequence", () => {
    const collector = new BoundedVerificationLogCollector(1);
    collector.log(event());
    collector.log(event({ code: "IGNORED" }));
    assertEquals(collector.events, [event()]);
    assertEquals(new BoundedVerificationLogCollector(0).events, []);
  });

  it("bounds individual event payloads before forwarding and retaining", async () => {
    const forwarded: VerificationLogEvent[] = [];
    const logs = await recordVerificationLog({
      event: event({
        message: "x".repeat(200),
        data: { large: "x".repeat(200) },
      }),
      logs: [],
      limits: { ...TEST_LIMITS, maxLogBytes: 80 },
      logging: {
        logger: {
          log: (value) => {
            forwarded.push(value);
          },
        },
      },
    });
    assertEquals(logs, forwarded);
    assertEquals(logs[0].data, undefined);
    assertEquals(
      logs[0].message.includes("[event truncated by Colibri]"),
      true,
    );
  });

  it("emits one stable truncation event when the sequence limit is reached", async () => {
    const limits = { ...TEST_LIMITS, maxLogEvents: 2 };
    const first = event({ code: "FIRST" });
    const second = event({ code: "SECOND" });
    const logs = await recordVerificationLog({
      event: event({ code: "THIRD" }),
      logs: [first, second],
      limits,
    });
    assertEquals(logs, [first, {
      timestamp: TEST_NOW,
      stage: "resolve-verification-target",
      level: "warning",
      code: "BLDV_LOG_TRUNCATED",
      message: "Additional structured verification events were omitted.",
    }]);
  });

  it("ignores best-effort logger failures and maps strict failures", async () => {
    const failing = { log: () => Promise.reject(new Error("logger")) };
    const logs = await recordVerificationLog({
      event: event(),
      logs: [],
      limits: TEST_LIMITS,
      logging: { logger: failing },
    });
    assertEquals(logs, [event()]);
    await assertRejects(
      () =>
        recordVerificationLog({
          event: event(),
          logs: [],
          limits: TEST_LIMITS,
          logging: { logger: failing, strict: true },
        }),
      LoggerFailedError,
    );
  });

  it("writes stable evidence JSON from evidence or completed result", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const first = `${directory}/evidence.json`;
      const second = `${directory}/result.json`;
      const evidence = testEvidence();
      await writeVerificationEvidence(first, evidence);
      await writeVerificationEvidence(second, { status: "verified", evidence });
      assertEquals(
        await Deno.readTextFile(first),
        `${JSON.stringify(evidence, null, 2)}\n`,
      );
      assertEquals(
        await Deno.readTextFile(second),
        await Deno.readTextFile(first),
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("writes JSONL, text, and empty structured log files", async () => {
    const directory = await Deno.makeTempDir();
    try {
      const jsonl = `${directory}/events.jsonl`;
      const text = `${directory}/events.txt`;
      const empty = `${directory}/empty.jsonl`;
      const events = [event(), event({ data: undefined, level: "warning" })];
      await writeVerificationLogs(jsonl, events);
      await writeVerificationLogs(text, events, { format: "text" });
      await writeVerificationLogs(empty, []);
      assertEquals(
        await Deno.readTextFile(jsonl),
        `${events.map((value) => JSON.stringify(value)).join("\n")}\n`,
      );
      assertEquals(
        await Deno.readTextFile(text),
        `${TEST_NOW} INFO resolve-verification-target BLDV_TEST test event {"safe":true}\n${TEST_NOW} WARNING resolve-verification-target BLDV_TEST test event\n`,
      );
      assertEquals(await Deno.readTextFile(empty), "");
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });

  it("maps evidence and log export failures to their unique errors", async () => {
    const directory = await Deno.makeTempDir();
    try {
      await assertRejects(
        () =>
          writeVerificationEvidence(
            `${directory}/missing/evidence.json`,
            testEvidence(),
          ),
        EvidenceWriteFailedError,
      );
      await assertRejects(
        () => writeVerificationLogs(`${directory}/missing/logs.jsonl`, []),
        LogWriteFailedError,
      );
    } finally {
      await Deno.remove(directory, { recursive: true });
    }
  });
});
