import { accumulateVerificationEvidence } from "@/core/evidence/accumulate.ts";
import { createContractBuildArguments } from "@/core/recipe/build-command.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import {
  attachBuildVerificationErrorContext,
  BuildVerificationError,
} from "@/error/base.ts";
import {
  contextualizeProcessError,
  recordProcessEvent,
} from "@/processes/shared.ts";
import {
  ExecuteContractBuildUnexpectedError,
  WorkspaceCleanupFailedError,
  WorkspaceInitializationFailedError,
} from "@/processes/execute-contract-build/error.ts";
import type {
  ExecuteContractBuildInput,
  ExecuteContractBuildOutput,
} from "@/processes/execute-contract-build/types.ts";

/** Owns disposable source extraction, execution, candidate capture, and cleanup. */
export const executeContractBuild = async (
  input: ExecuteContractBuildInput,
): Promise<ExecuteContractBuildOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  const redactedInput = redactContractBuildVerificationInput(
    input.state.value.request,
  );
  let workspaceDirectory: string;
  try {
    workspaceDirectory =
      await (input.workspace?.makeTempDir ?? Deno.makeTempDir)({
        prefix: "colibri-build-verification-",
      });
  } catch (error) {
    throw contextualizeProcessError(
      new WorkspaceInitializationFailedError(error),
      new ExecuteContractBuildUnexpectedError(error),
      { input: redactedInput, evidence, logs },
    );
  }

  let output: ExecuteContractBuildOutput | undefined;
  let primaryError: unknown;
  try {
    const extracted = await input.extractor.extract({
      source: input.state.value.source,
      workspaceDirectory,
      limits: input.limits,
    });
    const before = await input.artifactCollector.snapshot(
      extracted.sourceDirectory,
      input.limits,
    );
    const buildArguments = createContractBuildArguments(
      input.state.value.recipe,
    );
    const execution = await input.runner.run({
      sourceDirectory: extracted.sourceDirectory,
      image: input.state.value.image,
      arguments: buildArguments,
      rustupToolchain: input.state.value.image.rustupToolchain!,
      allowNetwork: input.allowBuildNetwork,
      limits: input.limits,
    });
    const candidates = await input.artifactCollector.collect(
      extracted.sourceDirectory,
      before,
      input.limits,
    );
    evidence = accumulateVerificationEvidence(evidence, {
      execution: {
        image: input.state.value.image.reference,
        arguments: buildArguments,
        rustupToolchain: input.state.value.image.rustupToolchain!,
        networkEnabled: input.allowBuildNetwork,
        limits: { ...input.limits },
        runner: execution.runner,
        capabilities: execution.capabilities,
        runtimeImageDigest: execution.runtimeImageDigest,
        exitCode: execution.exitCode,
        durationMs: execution.durationMs,
        stdout: execution.stdout,
        stderr: execution.stderr,
        candidates: candidates.map(({ path, size, sha256 }) => ({
          path,
          size,
          sha256,
        })),
      },
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "execute-contract-build",
      level: "info",
      code: "BLDV_CONTRACT_BUILD_EXECUTED",
      message:
        "Executed the isolated build and captured bounded Wasm candidates.",
      data: {
        candidateCount: candidates.length,
        networkEnabled: input.allowBuildNetwork,
        durationMs: execution.durationMs,
      },
    });
    output = {
      state: "active",
      value: {
        ...input.state.value,
        buildArguments,
        execution,
        candidates,
      },
      evidence,
      logs,
    };
  } catch (error) {
    primaryError = error;
  }

  let cleanupError: WorkspaceCleanupFailedError | undefined;
  try {
    await (input.workspace?.remove ?? Deno.remove)(workspaceDirectory, {
      recursive: true,
    });
  } catch (error) {
    cleanupError = new WorkspaceCleanupFailedError(workspaceDirectory, error);
  }

  if (primaryError) {
    const normalized = contextualizeProcessError(
      primaryError,
      new ExecuteContractBuildUnexpectedError(primaryError),
      { input: redactedInput, evidence, logs },
    );
    if (cleanupError && normalized instanceof BuildVerificationError) {
      throw attachBuildVerificationErrorContext(normalized, {
        input: {
          request: redactedInput,
          cleanupFailure: cleanupError.toJSON(),
        },
        evidence,
        logs,
      });
    }
    throw normalized;
  }
  if (cleanupError) {
    throw contextualizeProcessError(
      cleanupError,
      new ExecuteContractBuildUnexpectedError(cleanupError),
      { input: redactedInput, evidence, logs },
    );
  }
  return output!;
};

/** Error constructors emitted by {@link executeContractBuild}. */
export * from "@/processes/execute-contract-build/error.ts";
/** Process contracts used by {@link executeContractBuild}. */
export * from "@/processes/execute-contract-build/types.ts";
