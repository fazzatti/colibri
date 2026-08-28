import type {
  BuildVerificationLimits,
  ResolvedVerificationSource,
  VerificationState,
} from "../../core/index.ts";
import type { VerificationLogging } from "../../reporting/types.ts";
import type { VerificationSourceProvider } from "../../providers/source/types.ts";
import type { ValidatedBuildRecipeValue } from "../validate-build-recipe/types.ts";

/** Active value produced after exact source resolution and hash checking. */
export type ResolvedSourceArchiveValue = ValidatedBuildRecipeValue & {
  readonly source: ResolvedVerificationSource;
};

/** Input accepted by {@link resolveSourceArchive}. */
export type ResolveSourceArchiveInput = {
  readonly state: VerificationState<ValidatedBuildRecipeValue>;
  readonly provider: VerificationSourceProvider;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Output produced by {@link resolveSourceArchive}. */
export type ResolveSourceArchiveOutput = VerificationState<
  ResolvedSourceArchiveValue
>;
