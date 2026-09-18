import { join } from "node:path";
import type { Collector } from "@/recorder/runtime/collector.ts";

/** Optional environment lookup does not require --allow-env for memory-only use. */
export function environment(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}
/** Sequential, awaited writes avoid cross-test resource leaks and shared-file contention. */
export class Journal {
  constructor(
    private readonly collector: Collector,
    readonly directory?: string,
  ) {
    collector.journalEnabled = Boolean(directory);
  }
  /** Registration is synchronous, including ignored files with no callbacks. */
  flushSync(): void {
    if (!this.directory || !this.collector.pending.length) return;
    try {
      Deno.mkdirSync(join(this.directory, "fragments"), { recursive: true });
      Deno.writeTextFileSync(
        join(this.directory, "fragments", `${this.collector.fragmentId}.jsonl`),
        this.collector.pending.map((event) => JSON.stringify(event)).join(
          "\n",
        ) + "\n",
        { append: true },
      );
      this.collector.pending.length = 0;
    } catch (error) {
      this.collector.diagnostic(
        `Journal write failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  flush(): Promise<void> {
    // One synchronous append also covers registration-only files. Avoid mixing
    // pending asynchronous appends with registration flushes in the same runtime.
    this.flushSync();
    return Promise.resolve();
  }
}
