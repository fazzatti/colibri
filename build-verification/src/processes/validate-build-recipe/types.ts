import type {
  BuildCommandPolicy,
  BuildOptionPolicy,
  BuildVerificationLimits,
  ContractBuildRecipe,
  VerificationState,
} from "@/core/index.ts";
import type { VerificationLogging } from "@/reporting/types.ts";
import type { ParsedContractMetadataValue } from "@/processes/parse-contract-metadata/types.ts";

/** Active value produced after recipe and execution-policy validation. */
export type ValidatedBuildRecipeValue = ParsedContractMetadataValue & {
  readonly recipe: ContractBuildRecipe;
};

/** Input accepted by {@link validateBuildRecipe}. */
export type ValidateBuildRecipeInput = {
  readonly state: VerificationState<ParsedContractMetadataValue>;
  readonly commandPolicy: BuildCommandPolicy;
  readonly optionPolicy: BuildOptionPolicy;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Output produced by {@link validateBuildRecipe}. */
export type ValidateBuildRecipeOutput = VerificationState<
  ValidatedBuildRecipeValue
>;
