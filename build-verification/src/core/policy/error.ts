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
