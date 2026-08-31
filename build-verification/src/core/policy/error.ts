import { BuildVerificationError, Code } from "@/error/base.ts";

/** Raised when a configured image policy rejects resolved image facts. */
export class ImagePolicyRejectedError
  extends BuildVerificationError<Code.IMAGE_POLICY_REJECTED> {
  /** Creates an image-policy rejection error. */
  constructor(reference: string, reason: string) {
    super({
      code: Code.IMAGE_POLICY_REJECTED,
      source: "@colibri/build-verification/core/policy/image",
      message: "Build image rejected by policy",
      details: reason,
      data: { reference },
    });
  }
}

/** Raised before I/O when an image reference violates its trust policy. */
export class ImageReferencePolicyRejectedError
  extends BuildVerificationError<Code.IMAGE_REFERENCE_POLICY_REJECTED> {
  /** Creates a pre-I/O image-reference policy rejection. */
  constructor(reference: string, details: string) {
    super({
      code: Code.IMAGE_REFERENCE_POLICY_REJECTED,
      source: "@colibri/build-verification/processes/resolve-build-image",
      message: "Build image reference rejected by policy",
      details,
      data: { reference },
    });
  }
}

/** Raised when a command policy rejects producer-controlled arguments. */
export class CommandPolicyRejectedError
  extends BuildVerificationError<Code.COMMAND_POLICY_REJECTED> {
  /** Creates a command-policy rejection error. */
  constructor(arguments_: readonly string[], reasons: readonly string[]) {
    super({
      code: Code.COMMAND_POLICY_REJECTED,
      source: "@colibri/build-verification/core/policy/command",
      message: "Build command rejected by policy",
      details: reasons.join(" ") || "The effective build command was rejected.",
      data: { arguments: arguments_, reasons },
    });
  }
}

/** Raised when an option policy rejects producer-controlled arguments. */
export class OptionPolicyRejectedError
  extends BuildVerificationError<Code.OPTION_POLICY_REJECTED> {
  /** Creates an option-policy rejection error. */
  constructor(options: readonly string[], reasons: readonly string[]) {
    super({
      code: Code.OPTION_POLICY_REJECTED,
      source: "@colibri/build-verification/core/policy/options",
      message: "Build options rejected by policy",
      details: reasons.join(" ") ||
        "The effective build options were rejected.",
      data: { options, reasons },
    });
  }
}
