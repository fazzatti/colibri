import { BuildVerificationError, Code } from "@/error/base.ts";

/** Base error for failures raised by the build-verification CLI. */
export abstract class BuildVerificationCliError<C extends Code>
  extends BuildVerificationError<C> {
  /** Creates a CLI error with the shared package source metadata. */
  constructor(
    code: C,
    message: string,
    details: string,
    data: Readonly<Record<string, unknown>> = {},
    cause?: unknown,
  ) {
    super({
      code,
      source: "@colibri/build-verification/cli",
      message,
      details,
      data,
      cause,
    });
  }
}

/** Raised when the CLI receives an unsupported positional argument. */
export class CliPositionalArgumentUnsupportedError
  extends BuildVerificationCliError<Code.CLI_POSITIONAL_ARGUMENT_UNSUPPORTED> {
  /** Creates an unsupported positional-argument error. */
  constructor(argument: string) {
    super(
      Code.CLI_POSITIONAL_ARGUMENT_UNSUPPORTED,
      "Positional command-line arguments are not supported",
      "Every CLI argument must be a named flag.",
      { argument },
    );
  }
}

/** Raised when the CLI receives an unknown named flag. */
export class CliUnknownFlagError
  extends BuildVerificationCliError<Code.CLI_UNKNOWN_FLAG> {
  /** Creates an unknown-flag error. */
  constructor(flag: string) {
    super(
      Code.CLI_UNKNOWN_FLAG,
      "Unknown command-line flag",
      `Flag ${flag} is not supported.`,
      { flag },
    );
  }
}

/** Raised when one CLI flag is repeated. */
export class CliDuplicateFlagError
  extends BuildVerificationCliError<Code.CLI_DUPLICATE_FLAG> {
  /** Creates a duplicate-flag error. */
  constructor(flag: string) {
    super(
      Code.CLI_DUPLICATE_FLAG,
      "Repeated command-line flag",
      `Flag ${flag} cannot be repeated.`,
      { flag },
    );
  }
}

/** Raised when a value-bearing CLI flag has no value. */
export class CliFlagValueMissingError
  extends BuildVerificationCliError<Code.CLI_FLAG_VALUE_MISSING> {
  /** Creates a missing flag-value error. */
  constructor(flag: string) {
    super(
      Code.CLI_FLAG_VALUE_MISSING,
      "Command-line flag value is missing",
      `Flag ${flag} requires a value.`,
      { flag },
    );
  }
}

/** Raised when help is combined with an executable option. */
export class CliHelpConflictError
  extends BuildVerificationCliError<Code.CLI_HELP_CONFLICT> {
  /** Creates a help-conflict error. */
  constructor() {
    super(
      Code.CLI_HELP_CONFLICT,
      "Help flag cannot be combined",
      "Use -h or --help without other flags.",
    );
  }
}

/** Raised when the requested CLI log format is unsupported. */
export class CliLogFormatInvalidError
  extends BuildVerificationCliError<Code.CLI_LOG_FORMAT_INVALID> {
  /** Creates an invalid log-format error. */
  constructor(format: string) {
    super(
      Code.CLI_LOG_FORMAT_INVALID,
      "Invalid command-line log format",
      "The --log-format value must be jsonl or text.",
      { format },
    );
  }
}

/** Raised when a log format is selected without a log destination. */
export class CliLogFormatRequiresLogsError
  extends BuildVerificationCliError<Code.CLI_LOG_FORMAT_REQUIRES_LOGS> {
  /** Creates a missing log-destination error. */
  constructor() {
    super(
      Code.CLI_LOG_FORMAT_REQUIRES_LOGS,
      "Log output destination is missing",
      "The --log-format flag requires --logs.",
    );
  }
}

/** Raised when the CLI target flags do not identify exactly one target. */
export class CliTargetSelectionInvalidError
  extends BuildVerificationCliError<Code.CLI_TARGET_SELECTION_INVALID> {
  /** Creates an invalid target-selection error. */
  constructor() {
    super(
      Code.CLI_TARGET_SELECTION_INVALID,
      "Invalid verification target selection",
      "Choose exactly one of --contract-id, --wasm-hash, --wasm, or one complete external-reference group.",
    );
  }
}

/** Raised when external-reference target flags do not form one complete target. */
export class CliExternalReferenceIncompleteError
  extends BuildVerificationCliError<Code.CLI_EXTERNAL_REFERENCE_INCOMPLETE> {
  /** Creates an incomplete external-reference target error. */
  constructor() {
    super(
      Code.CLI_EXTERNAL_REFERENCE_INCOMPLETE,
      "Incomplete external-reference target",
      "An external-reference target requires --external-ref-owner and exactly one of --external-ref-tag or --external-ref-tag-base64.",
    );
  }
}

/** Raised when an external-reference tag is not valid base64. */
export class CliExternalReferenceTagInvalidError
  extends BuildVerificationCliError<Code.CLI_EXTERNAL_REFERENCE_TAG_INVALID> {
  /** Creates an invalid external-reference-tag error. */
  constructor(value: string, cause: unknown) {
    super(
      Code.CLI_EXTERNAL_REFERENCE_TAG_INVALID,
      "Invalid external-reference tag",
      "The --external-ref-tag-base64 value must contain valid base64-encoded tag bytes.",
      { value },
      cause,
    );
  }
}

/** Raised when a local Wasm target cannot be read. */
export class CliTargetFileReadFailedError
  extends BuildVerificationCliError<Code.CLI_TARGET_FILE_READ_FAILED> {
  /** Creates a target-file read error. */
  constructor(path: string, cause: unknown) {
    super(
      Code.CLI_TARGET_FILE_READ_FAILED,
      "Verification target file could not be read",
      `The --wasm target at ${path} could not be read.`,
      { path },
      cause,
    );
  }
}

/** Raised when preset and granular network flags are combined. */
export class CliNetworkConfigurationConflictError
  extends BuildVerificationCliError<Code.CLI_NETWORK_CONFIGURATION_CONFLICT> {
  /** Creates a conflicting network-configuration error. */
  constructor() {
    super(
      Code.CLI_NETWORK_CONFIGURATION_CONFLICT,
      "Conflicting network configuration",
      "The --network preset cannot be combined with granular RPC flags.",
    );
  }
}

/** Raised when a network preset is not supported. */
export class CliNetworkPresetInvalidError
  extends BuildVerificationCliError<Code.CLI_NETWORK_PRESET_INVALID> {
  /** Creates an invalid network-preset error. */
  constructor(preset: string) {
    super(
      Code.CLI_NETWORK_PRESET_INVALID,
      "Invalid network preset",
      "The --network value must be mainnet, testnet, or futurenet.",
      { preset },
    );
  }
}

/** Raised when granular RPC configuration is incomplete. */
export class CliNetworkConfigurationIncompleteError
  extends BuildVerificationCliError<Code.CLI_NETWORK_CONFIGURATION_INCOMPLETE> {
  /** Creates an incomplete network-configuration error. */
  constructor() {
    super(
      Code.CLI_NETWORK_CONFIGURATION_INCOMPLETE,
      "Incomplete network configuration",
      "Granular configuration requires both --rpc-url and --network-passphrase.",
    );
  }
}

/** Raised when HTTP permission is requested without a granular RPC URL. */
export class CliAllowHttpRequiresNetworkError
  extends BuildVerificationCliError<Code.CLI_ALLOW_HTTP_REQUIRES_NETWORK> {
  /** Creates an invalid HTTP-permission error. */
  constructor() {
    super(
      Code.CLI_ALLOW_HTTP_REQUIRES_NETWORK,
      "HTTP network permission has no granular RPC target",
      "The --allow-http flag requires --rpc-url and --network-passphrase.",
    );
  }
}

/** Raised when multiple source groups are selected. */
export class CliSourceSelectionInvalidError
  extends BuildVerificationCliError<Code.CLI_SOURCE_SELECTION_INVALID> {
  /** Creates an invalid source-selection error. */
  constructor() {
    super(
      Code.CLI_SOURCE_SELECTION_INVALID,
      "Invalid verification source selection",
      "Choose only one local, URL, GitHub revision, or GitHub release source.",
    );
  }
}

/** Raised when a GitHub source omits its owner or repository. */
export class CliGitHubSourceIncompleteError
  extends BuildVerificationCliError<Code.CLI_GITHUB_SOURCE_INCOMPLETE> {
  /** Creates an incomplete GitHub-source error. */
  constructor() {
    super(
      Code.CLI_GITHUB_SOURCE_INCOMPLETE,
      "Incomplete GitHub source",
      "Every GitHub source requires --github-owner and --github-repository.",
    );
  }
}

/** Raised when GitHub revision and release flags are mixed. */
export class CliGitHubRevisionConflictError
  extends BuildVerificationCliError<Code.CLI_GITHUB_REVISION_CONFLICT> {
  /** Creates a conflicting GitHub-source error. */
  constructor() {
    super(
      Code.CLI_GITHUB_REVISION_CONFLICT,
      "Conflicting GitHub source",
      "A GitHub revision cannot be combined with release flags.",
    );
  }
}

/** Raised when the selected GitHub archive format is unsupported. */
export class CliGitHubFormatInvalidError
  extends BuildVerificationCliError<Code.CLI_GITHUB_FORMAT_INVALID> {
  /** Creates an invalid GitHub-format error. */
  constructor(format: string) {
    super(
      Code.CLI_GITHUB_FORMAT_INVALID,
      "Invalid GitHub archive format",
      "The --github-format value must be tar.gz or zip.",
      { format },
    );
  }
}

/** Raised when GitHub release flags do not form one complete source. */
export class CliGitHubReleaseInvalidError
  extends BuildVerificationCliError<Code.CLI_GITHUB_RELEASE_INVALID> {
  /** Creates an invalid GitHub-release source error. */
  constructor() {
    super(
      Code.CLI_GITHUB_RELEASE_INVALID,
      "Invalid GitHub release source",
      "A release source requires both release flags and does not use --github-format.",
    );
  }
}

/** Raised when out-of-band mode has no caller-supplied source. */
export class CliOutOfBandSourceRequiredError
  extends BuildVerificationCliError<Code.CLI_OUT_OF_BAND_SOURCE_REQUIRED> {
  /** Creates a missing out-of-band source error. */
  constructor() {
    super(
      Code.CLI_OUT_OF_BAND_SOURCE_REQUIRED,
      "Out-of-band verification source is missing",
      "The --recipe mode requires an explicit source.",
    );
  }
}

/** Raised when an out-of-band recipe file cannot be read. */
export class CliRecipeFileReadFailedError
  extends BuildVerificationCliError<Code.CLI_RECIPE_FILE_READ_FAILED> {
  /** Creates a recipe-file read error. */
  constructor(path: string, cause: unknown) {
    super(
      Code.CLI_RECIPE_FILE_READ_FAILED,
      "Out-of-band recipe file could not be read",
      `The recipe at ${path} could not be read.`,
      { path },
      cause,
    );
  }
}

/** Raised when an out-of-band recipe is not valid JSON. */
export class CliRecipeJsonInvalidError
  extends BuildVerificationCliError<Code.CLI_RECIPE_JSON_INVALID> {
  /** Creates an invalid recipe-JSON error. */
  constructor(path: string, cause: unknown) {
    super(
      Code.CLI_RECIPE_JSON_INVALID,
      "Out-of-band recipe is not valid JSON",
      `The recipe at ${path} could not be decoded as JSON.`,
      { path },
      cause,
    );
  }
}

/** Raised when the CLI cannot read an explicitly selected environment value. */
export class CliEnvironmentReadFailedError
  extends BuildVerificationCliError<Code.CLI_ENVIRONMENT_READ_FAILED> {
  /** Creates an environment-read error. */
  constructor(name: string, cause: unknown) {
    super(
      Code.CLI_ENVIRONMENT_READ_FAILED,
      "Environment variable could not be read",
      "The environment variable selected by --github-token-env could not be read.",
      { name },
      cause,
    );
  }
}

/** Raised when an explicitly selected environment value is absent. */
export class CliEnvironmentValueMissingError
  extends BuildVerificationCliError<Code.CLI_ENVIRONMENT_VALUE_MISSING> {
  /** Creates a missing environment-value error. */
  constructor(name: string) {
    super(
      Code.CLI_ENVIRONMENT_VALUE_MISSING,
      "Environment variable is missing",
      "The variable selected by --github-token-env must contain a non-empty value.",
      { name },
    );
  }
}

/** Raised when a GitHub token is configured without a GitHub source. */
export class CliGitHubTokenSourceRequiredError
  extends BuildVerificationCliError<Code.CLI_GITHUB_TOKEN_SOURCE_REQUIRED> {
  /** Creates an invalid GitHub-token source error. */
  constructor() {
    super(
      Code.CLI_GITHUB_TOKEN_SOURCE_REQUIRED,
      "GitHub token has no GitHub source",
      "The --github-token-env flag requires an explicit GitHub revision or release source.",
    );
  }
}

/** Raised when an unexpected value escapes the CLI boundary. */
export class CliUnexpectedFailureError
  extends BuildVerificationCliError<Code.CLI_UNEXPECTED_FAILURE> {
  /** Creates an unexpected CLI-failure error. */
  constructor(cause: unknown) {
    super(
      Code.CLI_UNEXPECTED_FAILURE,
      "Unexpected command-line failure",
      "The CLI failed outside a recognized verification or reporting path.",
      {},
      cause,
    );
  }
}

/** Raised when the default verifier runtime cannot be loaded or initialized. */
export class CliRuntimeInitializationFailedError
  extends BuildVerificationCliError<Code.CLI_RUNTIME_INITIALIZATION_FAILED> {
  /** Creates a CLI runtime-initialization error. */
  constructor(cause: unknown) {
    super(
      Code.CLI_RUNTIME_INITIALIZATION_FAILED,
      "Verification runtime could not be initialized",
      "Check the documented Deno permissions and Docker configuration.",
      {},
      cause,
    );
  }
}
