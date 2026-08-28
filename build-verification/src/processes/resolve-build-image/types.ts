import type {
  BuildVerificationLimits,
  ContainerImageDetails,
  ContainerImagePolicy,
  PolicyDecision,
  VerificationState,
} from "../../core/index.ts";
import type { ContainerImageResolver } from "../../providers/image/types.ts";
import type { VerificationLogging } from "../../reporting/types.ts";
import type { ResolvedSourceArchiveValue } from "../resolve-source-archive/types.ts";

/** Active value produced after image resolution and trust evaluation. */
export type ResolvedBuildImageValue = ResolvedSourceArchiveValue & {
  readonly image: ContainerImageDetails;
  readonly imagePolicy: PolicyDecision;
};

/** Input accepted by {@link resolveBuildImage}. */
export type ResolveBuildImageInput = {
  readonly state: VerificationState<ResolvedSourceArchiveValue>;
  readonly resolver: ContainerImageResolver;
  readonly policy: ContainerImagePolicy;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Output produced by {@link resolveBuildImage}. */
export type ResolveBuildImageOutput = VerificationState<
  ResolvedBuildImageValue
>;
