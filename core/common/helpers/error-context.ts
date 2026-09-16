import type { BaseMeta, ColibriErrorShape } from "@/error/types.ts";
/** @internal Preserve the existing unknown-error normalization semantics. */
export function errorContext(
  cause: unknown,
  context: Partial<ColibriErrorShape<string, BaseMeta>>,
): Omit<ColibriErrorShape<string, BaseMeta>, "code"> {
  return {
    domain: context.domain ?? "helpers",
    source: context.source ?? "colibri",
    message: cause instanceof Error
      ? cause.message
      : context.message ?? "Unexpected error",
    details: context.details ??
      (cause instanceof Error ? cause.stack : "An unexpected error occurred"),
    diagnostic: context.diagnostic,
    meta: { ...context.meta, cause },
  };
}
