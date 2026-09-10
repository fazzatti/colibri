import { BindingError, Code } from "@/error.ts";
import { identifier } from "@/generation/type-map.ts";
import { TEMPLATE_CLASS_NAMES } from "@/generation/names.ts";

/** @internal Shared by the renderer and CLI before loading a source. */
export function validateClassName(name: string): void {
  if (
    !identifier(name) || TEMPLATE_CLASS_NAMES.has(name)
  ) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "Choose a valid class name without a TypeScript keyword or generated name collision",
    );
  }
}

/** @internal Apply the same registry naming rules in prompts and scaffolding. */
export function validatePackageName(
  name: string | undefined,
  target?: string,
): void {
  if (
    !name || !/^(?:@[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*$/.test(name) ||
    (target === "jsr" && !name.startsWith("@"))
  ) {
    throw new BindingError(
      Code.INVALID_OPTIONS,
      "Supply a valid package name (JSR requires @scope/name)",
    );
  }
}
