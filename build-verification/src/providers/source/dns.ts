import {
  SourceDnsEmptyError,
  SourceDnsResolutionFailedError,
} from "@/providers/source/error.ts";

/** Combines DNS outcomes without treating rejected lookups as empty answers. */
export const collectSourceDnsAddresses = (
  hostname: string,
  results: readonly PromiseSettledResult<readonly string[]>[],
): readonly string[] => {
  const addresses: string[] = [];
  const failures: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") addresses.push(...result.value);
    else failures.push(result.reason);
  }
  if (addresses.length > 0) return [...new Set(addresses)];
  if (failures.length > 0) {
    throw new SourceDnsResolutionFailedError(
      hostname,
      new AggregateError(
        failures,
        "Source DNS lookups failed without addresses",
      ),
    );
  }
  throw new SourceDnsEmptyError(hostname);
};
