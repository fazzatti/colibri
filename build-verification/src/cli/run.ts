import { ColibriError } from "@colibri/core";
import { InvalidCliArgumentsError } from "@/cli/error.ts";
import {
  formatBuildVerificationErrorSummary,
  formatBuildVerificationResultSummary,
} from "@/cli/format.ts";
import {
  BUILD_VERIFICATION_CLI_HELP,
  getBuildVerificationStringFlag,
  parseBuildVerificationFlags,
  verificationInputFromFlags,
  verificationNetworkFromFlags,
} from "@/cli/flags.ts";
import {
  type BuildVerificationCliIo,
  DEFAULT_BUILD_VERIFICATION_CLI_IO,
} from "@/cli/io.ts";
import type { BuildVerificationCliDependencies } from "@/cli/types.ts";
import {
  writeVerificationEvidence,
  writeVerificationLogs,
} from "@/reporting/index.ts";
import { ContractBuildVerifier } from "@/verifier/contract-build-verifier.ts";
import type { ContractBuildVerifierOptions } from "@/verifier/types.ts";

/** Executes the package CLI and returns its process exit code. */
export const runBuildVerificationCli = async (
  args: readonly string[],
  io: BuildVerificationCliIo = DEFAULT_BUILD_VERIFICATION_CLI_IO,
  dependencies: BuildVerificationCliDependencies = {},
): Promise<number> => {
  const jsonOutput = args.includes("--json");
  try {
    const flags = parseBuildVerificationFlags(args);
    if (flags.has("help")) {
      if (flags.size !== 1) {
        throw new InvalidCliArgumentsError(
          "--help cannot be combined with other flags.",
        );
      }
      io.stdout(BUILD_VERIFICATION_CLI_HELP);
      return 0;
    }
    const logFormat = getBuildVerificationStringFlag(flags, "log-format");
    const logsPath = getBuildVerificationStringFlag(flags, "logs");
    if (logFormat && logFormat !== "jsonl" && logFormat !== "text") {
      throw new InvalidCliArgumentsError(
        "--log-format must be jsonl or text.",
        { logFormat },
      );
    }
    if (logFormat && !logsPath) {
      throw new InvalidCliArgumentsError("--log-format requires --logs.");
    }
    const input = await verificationInputFromFlags(flags, io);
    const options: ContractBuildVerifierOptions = {
      network: verificationNetworkFromFlags(flags),
      allowBuildNetwork: flags.has("allow-build-network"),
    };
    const verifier = dependencies.createVerifier?.(options) ??
      new ContractBuildVerifier(options);
    const result = await verifier.verify(input);
    const evidencePath = getBuildVerificationStringFlag(flags, "evidence");
    if (evidencePath) {
      await (dependencies.writeEvidence ?? writeVerificationEvidence)(
        evidencePath,
        result,
      );
    }
    if (logsPath) {
      await (dependencies.writeLogs ?? writeVerificationLogs)(
        logsPath,
        result.evidence.logs,
        { format: logFormat === "text" ? "text" : "jsonl" },
      );
    }
    io.stdout(
      jsonOutput
        ? JSON.stringify(result, null, 2)
        : formatBuildVerificationResultSummary(result),
    );
    return result.status === "mismatch" ? 2 : 0;
  } catch (cause) {
    const error = ColibriError.is(cause) ? cause : new InvalidCliArgumentsError(
      "The CLI encountered an unexpected failure before verification completed.",
      { cause: String(cause) },
    );
    io.stderr(
      jsonOutput
        ? JSON.stringify(error.toJSON(), null, 2)
        : formatBuildVerificationErrorSummary(error),
    );
    return 1;
  }
};
