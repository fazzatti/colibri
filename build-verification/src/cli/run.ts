import { ColibriError } from "@colibri/core";
import type {
  ContractBuildVerificationEvidence,
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
} from "@/cli/types.ts";
import { Code } from "@/error/base.ts";
import {
  EvidenceWriteFailedError,
  LogWriteFailedError,
} from "@/reporting/error.ts";
import { serializeBuildVerificationError } from "@/reporting/serialize-error.ts";
import type { ContractBuildVerifierOptions } from "@/verifier/types.ts";

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
  let evidencePath: string | undefined;
  let logsPath: string | undefined;
  let logFormat: "jsonl" | "text" = "jsonl";
  let evidenceWritten = false;
  let logsWritten = false;
  let completedEvidence: ContractBuildVerificationEvidence | undefined;
  try {
    const flags = parseBuildVerificationFlags(args);
    if (flags.has("help")) {
      if (flags.size !== 1) {
        throw new CliHelpConflictError();
      }
      io.stdout(BUILD_VERIFICATION_CLI_HELP);
      return BuildVerificationCliExitCode.Verified;
    }
    const requestedLogFormat = getBuildVerificationStringFlag(
      flags,
      "log-format",
    );
    logsPath = getBuildVerificationStringFlag(flags, "logs");
    evidencePath = getBuildVerificationStringFlag(flags, "evidence");
    if (
      requestedLogFormat && requestedLogFormat !== "jsonl" &&
      requestedLogFormat !== "text"
    ) {
      throw new CliLogFormatInvalidError(requestedLogFormat);
    }
    if (requestedLogFormat && !logsPath) {
      throw new CliLogFormatRequiresLogsError();
    }
    logFormat = requestedLogFormat === "text" ? "text" : "jsonl";
    const input = await verificationInputFromFlags(flags, io);
    const containerNamePrefix = getBuildVerificationStringFlag(
      flags,
      "container-name-prefix",
    );
    const network = verificationNetworkFromFlags(flags);
    const githubToken = verificationGitHubTokenFromFlags(flags, io);
    const interactiveProgress = !jsonOutput && !flags.has("quiet") &&
      io.stderrIsTerminal?.() === true;
    const spinner = interactiveProgress && io.stderrWrite
      ? createBuildVerificationSpinner({ write: io.stderrWrite })
      : undefined;
    const options: ContractBuildVerifierOptions = {
      network,
      allowBuildNetwork: flags.has("allow-build-network"),
      githubToken,
      ...(containerNamePrefix ? { docker: { containerNamePrefix } } : {}),
      logger: interactiveProgress
        ? {
          log: (event) =>
            spinner
              ? spinner.update(formatBuildVerificationSpinnerStatus(event))
              : io.stderr(formatBuildVerificationProgress(event)),
        }
        : undefined,
    };
    let verifier:
      | ReturnType<
        NonNullable<BuildVerificationCliDependencies["createVerifier"]>
      >
      | undefined;
    let result: ContractBuildVerificationResult;
    try {
      try {
        verifier = dependencies.createVerifier?.(options);
        if (!verifier) {
          verifier = new (await import("@/verifier/contract-build-verifier.ts"))
            .ContractBuildVerifier(options);
        }
      } catch (cause) {
        if (ColibriError.is(cause)) throw cause;
        throw new CliRuntimeInitializationFailedError(cause);
      }
      result = await verifier.verify(input);
    } finally {
      spinner?.stop();
    }
    completedEvidence = result.evidence;
    if (evidencePath) {
      const writeEvidence = dependencies.writeEvidence ??
        (await import("@/reporting/evidence-writer.ts"))
          .writeVerificationEvidence;
      await writeEvidence(
        evidencePath,
        result,
      );
      evidenceWritten = true;
    }
    if (logsPath) {
      const writeLogs = dependencies.writeLogs ??
        (await import("@/reporting/log-writer.ts")).writeVerificationLogs;
      await writeLogs(
        logsPath,
        result.evidence.logs,
        { format: logFormat },
      );
      logsWritten = true;
    }
    io.stdout(
      jsonOutput
        ? JSON.stringify(result, null, 2)
        : formatBuildVerificationResultSummary(result),
    );
    return result.status === "mismatch"
      ? BuildVerificationCliExitCode.Mismatch
      : result.status === "notApplicable"
      ? BuildVerificationCliExitCode.NotApplicable
      : BuildVerificationCliExitCode.Verified;
  } catch (cause) {
    const error = ColibriError.is(cause)
      ? cause
      : new CliUnexpectedFailureError(cause);
    const failure = buildVerificationFailureReport(error, completedEvidence);
    const reportingErrors: ColibriError[] = [];
    if (
      evidencePath && !evidenceWritten &&
      error.code !== Code.EVIDENCE_WRITE_FAILED
    ) {
      try {
        const writeEvidence = dependencies.writeEvidence ??
          (await import("@/reporting/evidence-writer.ts"))
            .writeVerificationEvidence;
        await writeEvidence(
          evidencePath,
          failure,
        );
      } catch (reportingCause) {
        reportingErrors.push(
          ColibriError.is(reportingCause)
            ? reportingCause
            : new EvidenceWriteFailedError(evidencePath, reportingCause),
        );
      }
    }
    if (logsPath && !logsWritten && error.code !== Code.LOG_WRITE_FAILED) {
      try {
        const writeLogs = dependencies.writeLogs ??
          (await import("@/reporting/log-writer.ts")).writeVerificationLogs;
        await writeLogs(
          logsPath,
          failure.logs,
          { format: logFormat },
        );
      } catch (reportingCause) {
        reportingErrors.push(
          ColibriError.is(reportingCause)
            ? reportingCause
            : new LogWriteFailedError(logsPath, reportingCause),
        );
      }
    }
    const serializedError = failure.error;
    io.stderr(
      jsonOutput
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
    if (!jsonOutput) {
      for (const reportingError of reportingErrors) {
        io.stderr(formatBuildVerificationErrorSummary(reportingError));
      }
    }
    return BuildVerificationCliExitCode.Failed;
  }
};
