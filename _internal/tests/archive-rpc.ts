import type { rpc } from "stellar-sdk";

const transientStatuses = new Set<unknown>([429, 502, 503, 504]);

/** Retry only archive data reads, never callbacks, assertions or transactions. */
export function withArchiveReadRetries(
  server: rpc.Server,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): rpc.Server {
  const retry = async <T>(read: () => Promise<T>, attempt = 0): Promise<T> => {
    try {
      return await read();
    } catch (error) {
      const status = error && typeof error === "object" && "response" in error
        ? (error.response as { status?: unknown } | undefined)?.status
        : undefined;
      // Two retries per request. Exhaustion preserves the original error;
      // other HTTP failures and non-HTTP errors fail immediately.
      if (attempt === 2 || !transientStatuses.has(status)) throw error;
      await sleep(1_000 * (attempt + 1));
      return retry(read, attempt + 1);
    }
  };
  const getLedgers = server.getLedgers.bind(server);
  const getEvents = server.getEvents.bind(server);
  server.getLedgers = (request) => retry(() => getLedgers(request));
  server.getEvents = (request) => retry(() => getEvents(request));
  return server;
}
