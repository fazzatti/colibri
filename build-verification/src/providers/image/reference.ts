import type { ContainerImageReference } from "@/core/policy/types.ts";
import { InvalidImageReferenceError } from "@/providers/image/error.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;

/** Parses a fully qualified, digest-pinned image without performing I/O. */
export const parseContainerImageReference = (
  reference: string,
): ContainerImageReference => {
  if (!IMAGE_PATTERN.test(reference)) {
    throw new InvalidImageReferenceError(reference);
  }
  const slash = reference.indexOf("/");
  const at = reference.lastIndexOf("@");
  return {
    reference,
    registry: reference.slice(0, slash),
    repository: reference.slice(slash + 1, at),
    digest: reference.slice(at + 1),
  };
};
