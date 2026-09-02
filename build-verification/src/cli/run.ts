import { ColibriError } from "@colibri/core";
import type {
  ContractBuildVerificationEvidence,
  ContractBuildVerificationInput,
  ContractBuildVerificationResult,
} from "@/core/index.ts";
import {
  CliHelpConflictError,
  CliLogFormatInvalidError,
  CliLogFormatRequiresLogsError,
  CliRuntimeInitializationFailedError,
  CliUnexpectedFailureError,
} from "@/cli/error.ts";
import {
  formatBuildVerificationErrorSummary,
  formatBuildVerificationProgress,
  formatBuildVerificationResultSummary,
} from "@/cli/format.ts";
import {
  BUILD_VERIFICATION_CLI_HELP,
  getBuildVerificationStringFlag,
  parseBuildVerificationFlags,
  verificationGitHubTokenFromFlags,
  verificationInputFromFlags,
  verificationNetworkFromFlags,
} from "@/cli/flags.ts";
import {
  type BuildVerificationCliIo,
  DEFAULT_BUILD_VERIFICATION_CLI_IO,
} from "@/cli/io.ts";
import { buildVerificationFailureReport } from "@/cli/report.ts";
import {
  createBuildVerificationSpinner,
  formatBuildVerificationSpinnerStatus,
} from "@/cli/spinner.ts";
import {
  type BuildVerificationCliDependencies,
  BuildVerificationCliExitCode,
  type ParsedBuildVerificationFlags,
} from "@/cli/types.ts";
import { Code } from "@/error/base.ts";
import {
  EvidenceWriteFailedError,
  LogWriteFailedError,
} from "@/reporting/error.ts";
import { serializeBuildVerificationError } from "@/reporting/serialize-error.ts";
import type { ContractBuildVerifierOptions } from "@/verifier/types.ts";

type CliOutputOptions = {
  jsonOutput: boolean;
  evidencePath?: string;
  logsPath?: string;
  logFormat: "jsonl" | "text";
};

type CliRunState = CliOutputOptions & {
  evidenceWritten: boolean;
  logsWritten: boolean;
  completedEvidence?: ContractBuildVerificationEvidence;
};

const outputOptionsFromFlags = (
  flags: ParsedBuildVerificationFlags,
  jsonOutput: boolean,
  logsPath: string | undefined,
): Pick<CliOutputOptions, "jsonOutput" | "logFormat"> => {
  const requestedLogFormat = getBuildVerificationStringFlag(
    flags,
    "log-format",
  );
  if (
    requestedLogFormat && requestedLogFormat !== "jsonl" &&
    requestedLogFormat !== "text"
  ) {
    throw new CliLogFormatInvalidError(requestedLogFormat);
  }
  if (requestedLogFormat && !logsPath) {
    throw new CliLogFormatRequiresLogsError();
  }
  return {
    jsonOutput,
    logFormat: requestedLogFormat === "text" ? "text" : "jsonl",
  };
};

const createVerifierOptions = (
  flags: ParsedBuildVerificationFlags,
  io: BuildVerificationCliIo,
  jsonOutput: boolean,
): {
  options: ContractBuildVerifierOptions;
  spinner?: ReturnType<typeof createBuildVerificationSpinner>;
} => {
  const containerNamePrefix = getBuildVerificationStringFlag(
    flags,
    "container-name-prefix",
  );
  const network = verificationNetworkFromFlags(flags);
  const githubToken = verificationGitHubTokenFromFlags(flags, io);
  const interactive = !jsonOutput && !flags.has("quiet") &&
    io.stderrIsTerminal?.() === true;
  const spinner = interactive && io.stderrWrite
    ? createBuildVerificationSpinner({ write: io.stderrWrite })
    : undefined;
  return {
    spinner,
    options: {
      network,
      allowBuildNetwork: flags.has("allow-build-network"),
      githubToken,
      ...(containerNamePrefix ? { docker: { containerNamePrefix } } : {}),
      logger: interactive
        ? {
          log: (event) =>
            spinner
              ? spinner.update(formatBuildVerificationSpinnerStatus(event))
              : io.stderr(formatBuildVerificationProgress(event)),
        }
        : undefined,
    },
  };
};

const createVerifier = async (
  options: ContractBuildVerifierOptions,
  dependencies: BuildVerificationCliDependencies,
): Promise<
  ReturnType<
    NonNullable<BuildVerificationCliDependencies["createVerifier"]>
  >
> => {
  try {
    const injected = dependencies.createVerifier?.(options);
    if (injected) return injected;
    return new (await import("@/verifier/contract-build-verifier.ts"))
      .ContractBuildVerifier(options);
  } catch (cause) {
    if (ColibriError.is(cause)) throw cause;
    throw new CliRuntimeInitializationFailedError(cause);
  }
};

const verifyWithProgress = async (
  input: ContractBuildVerificationInput,
  options: ContractBuildVerifierOptions,
  spinner: ReturnType<typeof createBuildVerificationSpinner> | undefined,
  dependencies: BuildVerificationCliDependencies,
): Promise<ContractBuildVerificationResult> => {
  try {
    const verifier = await createVerifier(options, dependencies);
    return await verifier.verify(input);
  } finally {
    spinner?.stop();
  }
};

const writeSuccessfulArtifacts = async (
  state: CliRunState,
  result: ContractBuildVerificationResult,
  dependencies: BuildVerificationCliDependencies,
): Promise<void> => {
  state.completedEvidence = result.evidence;
  if (state.evidencePath) {
    const writeEvidence = dependencies.writeEvidence ??
      (await import("@/reporting/evidence-writer.ts"))
        .writeVerificationEvidence;
    await writeEvidence(state.evidencePath, result);
    state.evidenceWritten = true;
  }
  if (state.logsPath) {
    const writeLogs = dependencies.writeLogs ??
      (await import("@/reporting/log-writer.ts")).writeVerificationLogs;
    await writeLogs(state.logsPath, result.evidence.logs, {
      format: state.logFormat,
    });
    state.logsWritten = true;
  }
};

const verificationExitCode = (
  result: ContractBuildVerificationResult,
): BuildVerificationCliExitCode => {
  if (result.status === "mismatch") {
    return BuildVerificationCliExitCode.Mismatch;
  }
  if (result.status === "notApplicable") {
    return BuildVerificationCliExitCode.NotApplicable;
  }
  return BuildVerificationCliExitCode.Verified;
};

const writeFailureEvidence = async (
  state: CliRunState,
  error: ColibriError,
  failure: ReturnType<typeof buildVerificationFailureReport>,
  dependencies: BuildVerificationCliDependencies,
  reportingErrors: ColibriError[],
): Promise<void> => {
  if (
    !state.evidencePath || state.evidenceWritten ||
    error.code === Code.EVIDENCE_WRITE_FAILED
  ) return;
  try {
    const writeEvidence = dependencies.writeEvidence ??
      (await import("@/reporting/evidence-writer.ts"))
        .writeVerificationEvidence;
    await writeEvidence(state.evidencePath, failure);
  } catch (cause) {
    reportingErrors.push(
      ColibriError.is(cause)
        ? cause
        : new EvidenceWriteFailedError(state.evidencePath, cause),
    );
  }
};

const writeFailureLogs = async (
  state: CliRunState,
  error: ColibriError,
  failure: ReturnType<typeof buildVerificationFailureReport>,
  dependencies: BuildVerificationCliDependencies,
  reportingErrors: ColibriError[],
): Promise<void> => {
  if (
    !state.logsPath || state.logsWritten || error.code === Code.LOG_WRITE_FAILED
  ) {
    return;
  }
  try {
    const writeLogs = dependencies.writeLogs ??
      (await import("@/reporting/log-writer.ts")).writeVerificationLogs;
    await writeLogs(state.logsPath, failure.logs, { format: state.logFormat });
  } catch (cause) {
    reportingErrors.push(
      ColibriError.is(cause)
        ? cause
        : new LogWriteFailedError(state.logsPath, cause),
    );
  }
};

const reportCliFailure = (
  io: BuildVerificationCliIo,
  state: CliRunState,
  error: ColibriError,
  failure: ReturnType<typeof buildVerificationFailureReport>,
  reportingErrors: readonly ColibriError[],
): void => {
  const serializedError = failure.error;
  io.stderr(
    state.jsonOutput
      ? JSON.stringify(
        reportingErrors.length > 0
          ? {
            ...serializedError,
            reportingErrors: reportingErrors.map(
              serializeBuildVerificationError,
            ),
          }
          : serializedError,
        null,
        2,
      )
      : formatBuildVerificationErrorSummary(error),
  );
  if (!state.jsonOutput) {
    for (const reportingError of reportingErrors) {
      io.stderr(formatBuildVerificationErrorSummary(reportingError));
    }
  }
};

const handleCliFailure = async (
  cause: unknown,
  io: BuildVerificationCliIo,
  state: CliRunState,
  dependencies: BuildVerificationCliDependencies,
): Promise<number> => {
  const error = ColibriError.is(cause)
    ? cause
    : new CliUnexpectedFailureError(cause);
  const failure = buildVerificationFailureReport(
    error,
    state.completedEvidence,
  );
  const reportingErrors: ColibriError[] = [];
  await writeFailureEvidence(
    state,
    error,
    failure,
    dependencies,
    reportingErrors,
  );
  await writeFailureLogs(
    state,
    error,
    failure,
    dependencies,
    reportingErrors,
  );
  reportCliFailure(io, state, error, failure, reportingErrors);
  return BuildVerificationCliExitCode.Failed;
};

/** Executes the package CLI and returns its process exit code. */
export const runBuildVerificationCli = async (
  args: readonly string[],
  io: BuildVerificationCliIo = DEFAULT_BUILD_VERIFICATION_CLI_IO,
  dependencies: BuildVerificationCliDependencies = {},
): Promise<number> => {
  if (args.length === 0) {
    io.stdout(BUILD_VERIFICATION_CLI_HELP);
    return BuildVerificationCliExitCode.Verified;
  }
  const jsonOutput = args.includes("--json");
  const state: CliRunState = {
    jsonOutput,
    logFormat: "jsonl",
    evidenceWritten: false,
    logsWritten: false,
  };
  try {
    const flags = parseBuildVerificationFlags(args);
    if (flags.has("help")) {
      if (flags.size !== 1) {
        throw new CliHelpConflictError();
      }
      io.stdout(BUILD_VERIFICATION_CLI_HELP);
      return BuildVerificationCliExitCode.Verified;
    }
    state.evidencePath = getBuildVerificationStringFlag(flags, "evidence");
    state.logsPath = getBuildVerificationStringFlag(flags, "logs");
    Object.assign(
      state,
      outputOptionsFromFlags(flags, jsonOutput, state.logsPath),
    );
    const input = await verificationInputFromFlags(flags, io);
    const { options, spinner } = createVerifierOptions(flags, io, jsonOutput);
    const result = await verifyWithProgress(
      input,
      options,
      spinner,
      dependencies,
    );
    await writeSuccessfulArtifacts(state, result, dependencies);
    io.stdout(
      jsonOutput
        ? JSON.stringify(result, null, 2)
        : formatBuildVerificationResultSummary(result),
    );
    return verificationExitCode(result);
  } catch (cause) {
    return await handleCliFailure(cause, io, state, dependencies);
  }
};
