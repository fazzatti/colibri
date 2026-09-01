import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertStringIncludes,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core";
import * as E from "@/error.ts";

const allErrors = (): E.BuildVerificationError<E.Code>[] => {
  const cause = new Error("cause");
  return [
    new E.InvalidVerifierOptionsError("details", { value: 1 }),
    new E.MissingTargetNetworkError(),
    new E.TargetResolutionFailedError("target", cause),
    new E.InvalidTargetWasmError(cause),
    new E.MetadataDecodingFailedError(1, cause),
    new E.DuplicateSep58MetadataError("bldimg"),
    new E.InvalidSep58MetadataError("key", "value", "reason"),
    new E.MissingOutOfBandRecipeError(),
    new E.MissingVerificationSourceError(),
    new E.SourceDownloadFailedError("https://example.com", cause, 500),
    new E.SourceHashMismatchError("a", "b"),
    new E.UnsupportedSourceError("details", { source: "x" }),
    new E.UnsupportedArchiveError("source.rar"),
    new E.UnsafeArchiveEntryError("../escape", "reason"),
    new E.ArchiveLimitExceededError("files", 2, 1),
    new E.InvalidArchiveTopologyError(["a", "b"]),
    new E.InvalidImageReferenceError("image:latest"),
    new E.ImagePolicyRejectedError("image", "reason"),
    new E.ImageManifestResolutionFailedError("image", cause, 404),
    new E.MultiArchImageError("image", "index"),
    new E.DockerConfigurationFailedError("details", { socket: "x" }),
    new E.DockerContainerNamePrefixInvalidError("invalid prefix"),
    new E.DockerUnavailableError(cause),
    new E.ImagePullFailedError("image", cause),
    new E.ImageRuntimeMismatchError("image", ["sh"], "/"),
    new E.BuildTimedOutError(1, "out", "err"),
    new E.BuildCommandFailedError(1, "out", "err"),
    new E.BuildLogCollectionFailedError(cause),
    new E.BuildArtifactNotFoundError(),
    new E.BuildArtifactAmbiguousError(["a", "b"]),
    new E.BuildArtifactReadFailedError("a", cause),
    new E.EvidenceWriteFailedError("a", cause),
    new E.ImagePullStreamMissingError("image"),
    new E.ImagePullProgressFailedError("image", cause),
    new E.ImageInspectionFailedError("image", cause),
    new E.BuildArtifactSnapshotFailedError("a", cause),
    new E.ContainerCreationFailedError(cause),
    new E.ContainerStartFailedError(cause),
    new E.ContainerWaitFailedError(cause),
    new E.ContainerKillFailedError(cause),
    new E.ContainerLogsFailedError(cause),
    new E.ContainerCleanupFailedError(cause),
    new E.TargetRpcInitializationFailedError(cause),
    new E.ArchiveDecodingFailedError("source.tar", cause),
    new E.SourceExtractionInitializationFailedError(cause),
    new E.SourceExtractionFailedError(cause),
    new E.SourceExtractionCleanupFailedError(cause, cause),
    new E.LocalSourceArchiveReadFailedError("source.tar", cause),
    new E.SourceCleanupFailedError("source", cause),
    new E.TargetHashMismatchError("a", "b"),
    new E.TargetInstanceLookupFailedError("C123", cause),
    new E.TargetCodeLookupFailedError("target", cause),
    new E.ExternalReferenceTargetUnsupportedError(
      "CTARGET",
      "COWNER",
      new Uint8Array([1, 2, 3]),
    ),
    new E.TargetProviderUnexpectedError(cause),
    new E.CommandPolicyRejectedError(["contract"], ["reason"]),
    new E.OptionPolicyRejectedError(["--bad"], ["reason"]),
    new E.SourcePolicyRejectedError("https://example.com", ["reason"]),
    new E.SourceRedirectLimitExceededError("https://example.com", 1),
    new E.SourceDnsResolutionFailedError("example.com", cause),
    new E.SourceRequestTimedOutError("https://example.com", 1),
    new E.GitHubRevisionResolutionFailedError("owner/repo", "abc", cause),
    new E.GitHubReleaseAssetResolutionFailedError(
      "owner/repo",
      "v1",
      "source.tar",
      cause,
    ),
    new E.ZipDecodingFailedError("source.zip", cause),
    new E.DuplicateArchiveEntryError("source/file"),
    new E.ArchiveEntryTypeConflictError("source/file"),
    new E.WorkspaceInitializationFailedError(cause),
    new E.SourceDirectoryCopyFailedError("source", cause),
    new E.ArtifactLimitExceededError("artifact.wasm", 2, 1),
    new E.UnsafeArtifactPathError("../artifact.wasm"),
    new E.ImageConfigResolutionFailedError("image", cause, 404),
    new E.ImageReferrersResolutionFailedError("image", cause, 404),
    new E.ImageAttestationDecodingFailedError("sha256:abc", cause),
    new E.ImageToolchainMissingError("image"),
    new E.RuntimeImageDigestMismatchError("sha256:a", ["sha256:b"]),
    new E.LogWriteFailedError("logs.jsonl", cause),
    new E.LoggerFailedError(cause),
    new E.BuildVerificationPipelineConstructionError(cause),
    new E.ProcessDependencyMissingError("runner"),
    new E.ResolveVerificationTargetUnexpectedError(cause),
    new E.ParseContractMetadataUnexpectedError(cause),
    new E.ValidateBuildRecipeUnexpectedError(cause),
    new E.ResolveSourceArchiveUnexpectedError(cause),
    new E.ResolveBuildImageUnexpectedError(cause),
    new E.ExecuteContractBuildUnexpectedError(cause),
    new E.SelectBuildArtifactUnexpectedError(cause),
    new E.CompareContractWasmUnexpectedError(cause),
    new E.SourceResponseReadFailedError("https://example.com", cause),
    new E.WorkspaceCleanupFailedError("workspace", cause),
    new E.ArtifactCollectionFailedError("target", cause),
    new E.BuildPlanInvalidError("details", { plan: "invalid" }),
    new E.ImageManifestDigestMismatchError("image", "a", "b"),
    new E.ImageConfigDigestMismatchError("a", "b"),
    new E.ImageReferrerDigestMismatchError("a", "b"),
    new E.SourceRedirectLocationMissingError("https://example.com", 302),
    new E.InvalidVerificationInputError({ mode: "invalid" }),
    new E.PipelineStepOutputMissingError("step"),
    new E.BuildRunnerUnexpectedError(cause),
    new E.ArchiveCrcMismatchError("source/file", 1, 2),
    new E.UnsupportedZipFeatureError("source/file", "encrypted"),
    new E.SourceBuildAccessPreparationFailedError("source", cause),
    new E.ImageReferencePolicyRejectedError("image", "reason"),
    new E.ArchiveSourceProviderInputMismatchError("path"),
    new E.FileSourceProviderInputMismatchError("url"),
    new E.HttpSourceProviderInputMismatchError("path"),
    new E.GitHubSourceProviderInputMismatchError("archive"),
    new E.ImageAuthenticationChallengeInvalidError("image", cause),
    new E.ImageRegistryRequestRejectedError(
      "image",
      "https://registry.example",
      cause,
    ),
    new E.CliPositionalArgumentUnsupportedError("argument"),
    new E.CliUnknownFlagError("--unknown"),
    new E.CliDuplicateFlagError("--wasm"),
    new E.CliFlagValueMissingError("--wasm"),
    new E.CliHelpConflictError(),
    new E.CliLogFormatInvalidError("xml"),
    new E.CliLogFormatRequiresLogsError(),
    new E.CliTargetSelectionInvalidError(),
    new E.CliTargetFileReadFailedError("target.wasm", cause),
    new E.CliNetworkConfigurationConflictError(),
    new E.CliNetworkPresetInvalidError("unknown"),
    new E.CliNetworkConfigurationIncompleteError(),
    new E.CliAllowHttpRequiresNetworkError(),
    new E.CliSourceSelectionInvalidError(),
    new E.CliGitHubSourceIncompleteError(),
    new E.CliGitHubRevisionConflictError(),
    new E.CliGitHubFormatInvalidError("tar"),
    new E.CliGitHubReleaseInvalidError(),
    new E.CliOutOfBandSourceRequiredError(),
    new E.CliRecipeFileReadFailedError("recipe.json", cause),
    new E.CliRecipeJsonInvalidError("recipe.json", cause),
    new E.CliEnvironmentReadFailedError("GITHUB_TOKEN", cause),
    new E.CliEnvironmentValueMissingError("GITHUB_TOKEN"),
    new E.CliGitHubTokenSourceRequiredError(),
    new E.CliUnexpectedFailureError(cause),
    new E.CliRuntimeInitializationFailedError(cause),
  ];
};

describe("build-verification error catalog", () => {
  it("uses the package root as the default error source", () => {
    class RootOwnedError
      extends E.BuildVerificationError<E.Code.INVALID_VERIFIER_OPTIONS> {
      constructor() {
        super({
          code: E.Code.INVALID_VERIFIER_OPTIONS,
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
    assertEquals(errors.length, Object.keys(E.Code).length);
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
    const error = new E.InvalidVerifierOptionsError("details", {
      original: true,
    });
    const evidence = {
      package: {
        name: "@colibri/build-verification" as const,
        version: "0.3.0",
      },
      mode: "outOfBand" as const,
      logs: [],
      observedAt: "2026-08-28T12:00:00.000Z",
    };
    const contextualized = E.attachBuildVerificationErrorContext(error, {
      input: { safe: true },
      evidence,
      logs: [],
    });
    assertEquals(contextualized.meta?.data.original, true);
    assertEquals(contextualized.meta?.data.input, { safe: true });
    assertEquals(contextualized.meta?.data.evidence, evidence);
    assertEquals(contextualized.meta?.cause, undefined);

    const caused = new E.DockerUnavailableError(cause);
    E.attachBuildVerificationErrorContext(caused, { logs: [] });
    assertEquals(caused.meta?.cause, cause);
  });
});
