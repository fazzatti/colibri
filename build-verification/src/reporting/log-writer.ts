import { basename, dirname, resolve } from "node:path";
import type { VerificationLogEvent } from "../core/types/result.ts";
import { LogWriteFailedError } from "./error.ts";
import type { VerificationLogFormat } from "./types.ts";

const renderTextEvent = (event: VerificationLogEvent): string =>
  `${event.timestamp} ${event.level.toUpperCase()} ${event.stage} ${event.code} ${event.message}${
    event.data ? ` ${JSON.stringify(event.data)}` : ""
  }`;

/** Writes structured verification logs as JSONL or readable text atomically. */
export const writeVerificationLogs = async (
  path: string,
  events: readonly VerificationLogEvent[],
  options: { readonly format: VerificationLogFormat } = { format: "jsonl" },
): Promise<void> => {
  const target = resolve(path);
  const temporary = resolve(
    dirname(target),
    `.${basename(target)}.${crypto.randomUUID()}.tmp`,
  );
  const lines = options.format === "jsonl"
    ? events.map((event) => JSON.stringify(event))
    : events.map(renderTextEvent);
  try {
    await Deno.writeTextFile(
      temporary,
      lines.length > 0 ? `${lines.join("\n")}\n` : "",
      { createNew: true },
    );
    await Deno.rename(temporary, target);
  } catch (cause) {
    await Deno.remove(temporary).catch(() => undefined);
    throw new LogWriteFailedError(path, cause);
  }
};
