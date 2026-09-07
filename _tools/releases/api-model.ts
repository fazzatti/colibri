/** Stable, reviewable Deno declaration snapshots. Not a semantic compatibility oracle. */
export type Json = null | boolean | number | string | Json[] | {
  [key: string]: Json;
};
export type ApiSnapshot = Record<string, Record<string, Json>>;
const incidental = new Set(["location", "jsDoc", "resolution", "module_doc"]);

/** Keep signatures, generic parameters, literals, visibility, and overload order. */
export function normalizeDeclaration(value: Json): Json {
  if (Array.isArray(value)) return value.map(normalizeDeclaration);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().filter((key) => !incidental.has(key)).map((
      key,
    ) => [key, normalizeDeclaration(value[key])]),
  );
}

export type ApiChange = {
  entrypoint: string;
  symbol: string;
  kind: "added" | "removed" | "changed";
};
export function compareApis(
  before: ApiSnapshot,
  after: ApiSnapshot,
): ApiChange[] {
  const changes: ApiChange[] = [];
  for (
    const entrypoint of new Set([...Object.keys(before), ...Object.keys(after)])
  ) {
    const previous = before[entrypoint] ?? {};
    const current = after[entrypoint] ?? {};
    for (
      const symbol of new Set([
        ...Object.keys(previous),
        ...Object.keys(current),
      ])
    ) {
      if (!(symbol in current)) {
        changes.push({ entrypoint, symbol, kind: "removed" });
      } else if (!(symbol in previous)) {
        changes.push({ entrypoint, symbol, kind: "added" });
      } else if (
        JSON.stringify(previous[symbol]) !== JSON.stringify(current[symbol])
      ) changes.push({ entrypoint, symbol, kind: "changed" });
    }
  }
  return changes.sort((a, b) =>
    `${a.entrypoint}/${a.symbol}`.localeCompare(`${b.entrypoint}/${b.symbol}`)
  );
}
