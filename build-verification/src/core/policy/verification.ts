import type { VerificationPolicy } from "./types.ts";
import { DefaultBuildCommandPolicy } from "./build-command.ts";
import { DefaultBuildOptionPolicy } from "./build-options.ts";
import { OfficialStellarImagePolicy } from "./official-stellar-image.ts";
import { DefaultSourceRetrievalPolicy } from "./source-retrieval.ts";

/** Creates the conservative policy set with optional caller replacements. */
export const createDefaultVerificationPolicy = (
  replacements: Partial<VerificationPolicy> = {},
): VerificationPolicy => ({
  image: replacements.image ?? new OfficialStellarImagePolicy(),
  command: replacements.command ?? new DefaultBuildCommandPolicy(),
  options: replacements.options ?? new DefaultBuildOptionPolicy(),
  source: replacements.source ?? new DefaultSourceRetrievalPolicy(),
});
