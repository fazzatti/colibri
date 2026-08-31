import { accumulateVerificationEvidence } from "@/core/evidence/accumulate.ts";
import { imageDetailsForEvidence } from "@/core/evidence/finalize.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import { ImagePolicyRejectedError } from "@/core/policy/error.ts";
import { ImageToolchainMissingError } from "@/providers/image/error.ts";
import {
  contextualizeProcessError,
  recordProcessEvent,
} from "@/processes/shared.ts";
import { ResolveBuildImageUnexpectedError } from "@/processes/resolve-build-image/error.ts";
import type {
  ResolveBuildImageInput,
  ResolveBuildImageOutput,
} from "@/processes/resolve-build-image/types.ts";

/** Resolves OCI facts and applies image trust policy before any Docker pull. */
export const resolveBuildImage = async (
  input: ResolveBuildImageInput,
): Promise<ResolveBuildImageOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const image = await input.resolver.resolve(input.state.value.recipe.image);
    const decision = await input.policy.evaluate(image);
    if (!decision.accepted) {
      throw new ImagePolicyRejectedError(
        image.reference,
        decision.reasons.join(" ") || "The selected image was rejected.",
      );
    }
    if (!image.rustupToolchain) {
      throw new ImageToolchainMissingError(image.reference);
    }
    evidence = accumulateVerificationEvidence(evidence, {
      image: {
        details: imageDetailsForEvidence(image),
        policy: decision,
      },
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "resolve-build-image",
      level: decision.warnings.length > 0 ? "warning" : "info",
      code: "BLDV_BUILD_IMAGE_APPROVED",
      message: "Resolved exact OCI image facts and accepted the image policy.",
      data: {
        manifestDigest: image.manifestDigest,
        architecture: image.architecture ?? "unknown",
        os: image.os ?? "unknown",
      },
    });
    return {
      state: "active",
      value: { ...input.state.value, image, imagePolicy: decision },
      evidence,
      logs,
    };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new ResolveBuildImageUnexpectedError(error),
      {
        input: redactContractBuildVerificationInput(input.state.value.request),
        evidence,
        logs,
      },
    );
  }
};

/** Error constructors emitted by {@link resolveBuildImage}. */
export * from "@/processes/resolve-build-image/error.ts";
/** Process contracts used by {@link resolveBuildImage}. */
export * from "@/processes/resolve-build-image/types.ts";
