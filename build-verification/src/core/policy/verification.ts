import type { VerificationPolicy } from "@/core/policy/types.ts";
import { DefaultBuildCommandPolicy } from "@/core/policy/build-command.ts";
import { DefaultBuildOptionPolicy } from "@/core/policy/build-options.ts";
import { OfficialStellarImagePolicy } from "@/core/policy/official-stellar-image.ts";
import { DefaultSourceRetrievalPolicy } from "@/core/policy/source-retrieval.ts";

/** Creates the conservative policy set with optional caller replacements. */
export const createDefaultVerificationPolicy = (
  replacements: Partial<VerificationPolicy> = {},
): VerificationPolicy => ({
  image: replacements.image ?? new OfficialStellarImagePolicy(),
  command: replacements.command ?? new DefaultBuildCommandPolicy(),
  options: replacements.options ?? new DefaultBuildOptionPolicy(),
  source: replacements.source ?? new DefaultSourceRetrievalPolicy(),
});
