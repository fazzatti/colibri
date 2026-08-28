import { type Step, step } from "convee";
import { resolveSourceArchive } from "../processes/resolve-source-archive/index.ts";
import { RESOLVE_SOURCE_ARCHIVE_STEP_ID } from "./ids.ts";

/** Creates the resolve-source-archive step used in verifier pipelines. */
export const createResolveSourceArchiveStep = (): Step<
  Parameters<typeof resolveSourceArchive>[0],
  Awaited<ReturnType<typeof resolveSourceArchive>>,
  Error,
  typeof RESOLVE_SOURCE_ARCHIVE_STEP_ID
> => step(resolveSourceArchive, { id: RESOLVE_SOURCE_ARCHIVE_STEP_ID });
