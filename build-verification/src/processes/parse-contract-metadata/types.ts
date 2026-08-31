import type {
  BuildVerificationLimits,
  ExtractedContractMetadata,
  VerificationState,
} from "@/core/index.ts";
import type { VerificationLogging } from "@/reporting/types.ts";
import type { ResolvedVerificationTargetValue } from "@/processes/resolve-verification-target/types.ts";

/** Active value produced after ordered metadata extraction. */
export type ParsedContractMetadataValue = ResolvedVerificationTargetValue & {
  readonly metadata: ExtractedContractMetadata;
};

/** Input accepted by {@link parseContractMetadata}. */
export type ParseContractMetadataInput = {
  readonly state: VerificationState<ResolvedVerificationTargetValue>;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Output produced by {@link parseContractMetadata}. */
export type ParseContractMetadataOutput = VerificationState<
  ParsedContractMetadataValue
>;
