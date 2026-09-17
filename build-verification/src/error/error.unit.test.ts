import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertStringIncludes,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core";
import * as ERROR from "@/error.ts";

const allErrors = (): ERROR.BuildVerificationError<ERROR.Code>[] => {
  const cause = new Error("cause");
  return [
    new ERROR.InvalidVerifierOptionsError("details", { value: 1 }),
    new ERROR.MissingTargetNetworkError(),
    new ERROR.TargetResolutionFailedError("target", cause),
    new ERROR.InvalidTargetWasmError(cause),
    new ERROR.MetadataDecodingFailedError(1, cause),
    new ERROR.DuplicateSep58MetadataError("bldimg"),
    new ERROR.InvalidSep58MetadataError("key", "value", "reason"),
    new ERROR.MissingOutOfBandRecipeError(),
    new ERROR.MissingVerificationSourceError(),
    new ERROR.SourceDownloadFailedError("https://example.com", cause, 500),
    new ERROR.SourceHashMismatchError("a", "b"),
    new ERROR.UnsupportedSourceError("details", { source: "x" }),
    new ERROR.UnsupportedArchiveError("source.rar"),
    new ERROR.UnsafeArchiveEntryError("../escape", "reason"),
    new ERROR.ArchiveLimitExceededError("files", 2, 1),
    new ERROR.InvalidArchiveTopologyError(["a", "b"]),
    new ERROR.InvalidImageReferenceError("image:latest"),
    new ERROR.ImagePolicyRejectedError("image", "reason"),
    new ERROR.ImageManifestResolutionFailedError("image", cause, 404),
    new ERROR.MultiArchImageError("image", "index"),
    new ERROR.DockerConfigurationFailedError("details", { socket: "x" }),
    new ERROR.DockerContainerNamePrefixInvalidError("invalid prefix"),
    new ERROR.DockerUnavailableError(cause),
    new ERROR.ImagePullFailedError("image", cause),
    new ERROR.ImageRuntimeMismatchError("image", ["sh"], "/"),
    new ERROR.BuildTimedOutError(1, "out", "err"),
    new ERROR.BuildCommandFailedError(1, "out", "err"),
    new ERROR.BuildLogCollectionFailedError(cause),
    new ERROR.BuildArtifactNotFoundError(),
    new ERROR.BuildArtifactAmbiguousError(["a", "b"]),
    new ERROR.BuildArtifactReadFailedError("a", cause),
    new ERROR.EvidenceWriteFailedError("a", cause),
    new ERROR.ImagePullStreamMissingError("image"),
    new ERROR.ImagePullProgressFailedError("image", cause),
    new ERROR.ImageInspectionFailedError("image", cause),
    new ERROR.BuildArtifactSnapshotFailedError("a", cause),
    new ERROR.ContainerCreationFailedError(cause),
    new ERROR.ContainerStartFailedError(cause),
    new ERROR.ContainerWaitFailedError(cause),
    new ERROR.ContainerKillFailedError(cause),
    new ERROR.ContainerLogsFailedError(cause),
    new ERROR.ContainerCleanupFailedError(cause),
    new ERROR.TargetRpcInitializationFailedError(cause),
    new ERROR.ArchiveDecodingFailedError("source.tar", cause),
    new ERROR.SourceExtractionInitializationFailedError(cause),
    new ERROR.SourceExtractionFailedError(cause),
    new ERROR.SourceExtractionCleanupFailedError(cause, cause),
    new ERROR.LocalSourceArchiveReadFailedError("source.tar", cause),
    new ERROR.SourceCleanupFailedError("source", cause),
    new ERROR.TargetHashMismatchError("a", "b"),
    new ERROR.TargetInstanceLookupFailedError("C123", cause),
    new ERROR.TargetCodeLookupFailedError("target", cause),
    new ERROR.TargetExternalReferenceLookupFailedError("externalRef", cause),
    new ERROR.TargetProviderUnexpectedError(cause),
    new ERROR.CommandPolicyRejectedError(["contract"], ["reason"]),
    new ERROR.OptionPolicyRejectedError(["--bad"], ["reason"]),
    new ERROR.SourcePolicyRejectedError("https://example.com", ["reason"]),
    new ERROR.SourceRedirectLimitExceededError("https://example.com", 1),
    new ERROR.SourceDnsResolutionFailedError("example.com", cause),
    new ERROR.SourceDnsEmptyError("example.com"),
    new ERROR.GitHubCommitShaMissingError("owner/repo", "revision"),
    new ERROR.GitHubReleaseAssetMissingError("owner/repo", "v1", "source.tar"),
    new ERROR.SourceRequestTimedOutError("https://example.com", 1),
    new ERROR.GitHubRevisionResolutionFailedError("owner/repo", "abc", cause),
    new ERROR.GitHubReleaseAssetResolutionFailedError(
      "owner/repo",
      "v1",
      "source.tar",
      cause,
    ),
    new ERROR.ZipDecodingFailedError("source.zip", cause),
    new ERROR.DuplicateArchiveEntryError("source/file"),
    new ERROR.ArchiveEntryTypeConflictError("source/file"),
    new ERROR.WorkspaceInitializationFailedError(cause),
    new ERROR.SourceDirectoryCopyFailedError("source", cause),
    new ERROR.ArtifactLimitExceededError("artifact.wasm", 2, 1),
    new ERROR.UnsafeArtifactPathError("../artifact.wasm"),
    new ERROR.ImageConfigResolutionFailedError("image", cause, 404),
    new ERROR.ImageReferrersResolutionFailedError("image", cause, 404),
    new ERROR.ImageAttestationDecodingFailedError("sha256:abc", cause),
    new ERROR.ImageToolchainMissingError("image"),
    new ERROR.RuntimeImageDigestMismatchError("sha256:a", ["sha256:b"]),
    new ERROR.LogWriteFailedError("logs.jsonl", cause),
    new ERROR.LoggerFailedError(cause),
    new ERROR.BuildVerificationPipelineConstructionError(cause),
    new ERROR.ProcessDependencyMissingError("runner"),
    new ERROR.ResolveVerificationTargetUnexpectedError(cause),
    new ERROR.ParseContractMetadataUnexpectedError(cause),
    new ERROR.ValidateBuildRecipeUnexpectedError(cause),
    new ERROR.ResolveSourceArchiveUnexpectedError(cause),
    new ERROR.ResolveBuildImageUnexpectedError(cause),
    new ERROR.ExecuteContractBuildUnexpectedError(cause),
    new ERROR.SelectBuildArtifactUnexpectedError(cause),
    new ERROR.CompareContractWasmUnexpectedError(cause),
    new ERROR.SourceResponseReadFailedError("https://example.com", cause),
    new ERROR.WorkspaceCleanupFailedError("workspace", cause),
    new ERROR.ArtifactCollectionFailedError("target", cause),
    new ERROR.BuildPlanInvalidError("details", { plan: "invalid" }),
    new ERROR.ImageManifestDigestMismatchError("image", "a", "b"),
    new ERROR.ImageConfigDigestMismatchError("a", "b"),
    new ERROR.ImageReferrerDigestMismatchError("a", "b"),
    new ERROR.SourceRedirectLocationMissingError("https://example.com", 302),
    new ERROR.InvalidVerificationInputError({ mode: "invalid" }),
    new ERROR.PipelineStepOutputMissingError("step"),
    new ERROR.BuildRunnerUnexpectedError(cause),
    new ERROR.ArchiveCrcMismatchError("source/file", 1, 2),
    new ERROR.UnsupportedZipFeatureError("source/file", "encrypted"),
    new ERROR.SourceBuildAccessPreparationFailedError("source", cause),
    new ERROR.ImageReferencePolicyRejectedError("image", "reason"),
    new ERROR.ArchiveSourceProviderInputMismatchError("path"),
    new ERROR.FileSourceProviderInputMismatchError("url"),
    new ERROR.HttpSourceProviderInputMismatchError("path"),
    new ERROR.GitHubSourceProviderInputMismatchError("archive"),
    new ERROR.ImageAuthenticationChallengeInvalidError("image", cause),
    new ERROR.ImageRegistryRequestRejectedError(
      "image",
      "https://registry.example",
      cause,
    ),
    new ERROR.CliPositionalArgumentUnsupportedError("argument"),
    new ERROR.CliUnknownFlagError("--unknown"),
    new ERROR.CliDuplicateFlagError("--wasm"),
    new ERROR.CliFlagValueMissingError("--wasm"),
    new ERROR.CliHelpConflictError(),
    new ERROR.CliLogFormatInvalidError("xml"),
    new ERROR.CliLogFormatRequiresLogsError(),
    new ERROR.CliTargetSelectionInvalidError(),
    new ERROR.CliTargetFileReadFailedError("target.wasm", cause),
    new ERROR.CliNetworkConfigurationConflictError(),
    new ERROR.CliNetworkPresetInvalidError("unknown"),
    new ERROR.CliNetworkConfigurationIncompleteError(),
    new ERROR.CliAllowHttpRequiresNetworkError(),
    new ERROR.CliSourceSelectionInvalidError(),
    new ERROR.CliGitHubSourceIncompleteError(),
    new ERROR.CliGitHubRevisionConflictError(),
    new ERROR.CliGitHubFormatInvalidError("tar"),
    new ERROR.CliGitHubReleaseInvalidError(),
    new ERROR.CliOutOfBandSourceRequiredError(),
    new ERROR.CliRecipeFileReadFailedError("recipe.json", cause),
    new ERROR.CliRecipeJsonInvalidError("recipe.json", cause),
    new ERROR.CliEnvironmentReadFailedError("GITHUB_TOKEN", cause),
    new ERROR.CliEnvironmentValueMissingError("GITHUB_TOKEN"),
    new ERROR.CliGitHubTokenSourceRequiredError(),
    new ERROR.CliUnexpectedFailureError(cause),
    new ERROR.CliRuntimeInitializationFailedError(cause),
    new ERROR.CliExternalReferenceIncompleteError(),
    new ERROR.CliExternalReferenceTagInvalidError("invalid", cause),
  ];
};

describe("build-verification error catalog", () => {
  it("uses the package root as the default error source", () => {
    class RootOwnedError extends ERROR.BuildVerificationError<
      ERROR.Code.INVALID_VERIFIER_OPTIONS
    > {
      constructor() {
        super({
          code: ERROR.Code.INVALID_VERIFIER_OPTIONS,
          message: "Root-owned error",
          details: "Default source coverage.",
        });
      }
    }
    assertEquals(
      new RootOwnedError().source,
      "@colibri/build-verification",
    );
  });

  it("has one unique typed Colibri error for every stable code", () => {
    const errors = allErrors();
    assertEquals(errors.length, Object.keys(ERROR.Code).length);
    assertEquals(new Set(errors.map(({ code }) => code)).size, errors.length);
    for (const error of errors) {
      assertInstanceOf(error, ColibriError);
      assertEquals(error.domain, "verifiers");
      assertStringIncludes(error.source, "@colibri/build-verification");
      assert(error.message.length > 0);
      assert(error.details && error.details.length > 0);
      assertEquals(error.name, `ColibriError ${error.code}`);
      assertEquals(JSON.parse(JSON.stringify(error.toJSON())).code, error.code);
    }
  });

  it("attaches evidence and logs without replacing cause or existing data", () => {
    const cause = new Error("cause");
    const error = new ERROR.InvalidVerifierOptionsError("details", {
      original: true,
    });
    const evidence = {
      package: {
        name: "@colibri/build-verification" as const,
        version: "0.4.0",
      },
      mode: "outOfBand" as const,
      logs: [],
      observedAt: "2026-08-28T12:00:00.000Z",
    };
    const contextualized = ERROR.attachBuildVerificationErrorContext(error, {
      input: { safe: true },
      evidence,
      logs: [],
    });
    assertEquals(contextualized.meta?.data.original, true);
    assertEquals(contextualized.meta?.data.input, { safe: true });
    assertEquals(contextualized.meta?.data.evidence, evidence);
    assertEquals(contextualized.meta?.cause, undefined);

    const caused = new ERROR.DockerUnavailableError(cause);
    ERROR.attachBuildVerificationErrorContext(caused, { logs: [] });
    assertEquals(caused.meta?.cause, cause);
  });
});
