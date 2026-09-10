import { quote } from "@/generation/type-map.ts";

/** @internal Readable JSON-compatible constants, including trailing commas. */
export function literal(value: unknown, depth = 0): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const padding = "  ".repeat(depth + 1);
  const closing = "  ".repeat(depth);
  if (Array.isArray(value)) {
    return value.length
      ? `[\n${
        value.map((item) => `${padding}${literal(item, depth + 1)},`).join("\n")
      }\n${closing}]`
      : "[]";
  }
  const entries = Object.entries(value).filter(([, item]) =>
    item !== undefined
  );
  if (!entries.length) return "{}";
  return `{\n${
    entries.map(([key, item]) => {
      const property = key === "__proto__" ? `[${quote(key)}]` : quote(key);
      const rendered = literal(item, depth + 1);
      const inline = `${padding}${property}: ${rendered},`;
      return !rendered.includes("\n") && inline.length > 80
        ? `${padding}${property}:\n${padding}  ${rendered},`
        : inline;
    }).join("\n")
  }\n${closing}}`;
}
