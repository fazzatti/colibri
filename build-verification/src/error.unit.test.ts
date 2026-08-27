import { assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriError } from "@colibri/core";
import * as E from "@/error.ts";

describe("build-verification errors", () => {
  it("exposes one typed Colibri error for every stable code", () => {
    const cause = new Error("cause");
    const errors: E.BuildVerificationError<E.Code>[] = [
      new E.InvalidVerifierOptionsError("details", { value: 1 }),
      new E.MissingTargetNetworkError(),
      new E.TargetResolutionFailedError("target", cause),
      new E.TargetRpcInitializationFailedError(cause),
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
      new E.ArchiveDecodingFailedError("source.tgz", cause),
      new E.SourceExtractionInitializationFailedError(cause),
      new E.SourceExtractionFailedError(cause),
      new E.SourceExtractionCleanupFailedError(cause, cause),
      new E.LocalSourceArchiveReadFailedError("source.tar", cause),
      new E.SourceCleanupFailedError("source", cause),
      new E.UnsafeArchiveEntryError("../escape", "reason"),
      new E.ArchiveLimitExceededError("files", 2, 1),
      new E.InvalidArchiveTopologyError(["a", "b"]),
      new E.InvalidImageReferenceError("image:latest"),
      new E.ImagePolicyRejectedError("image", "reason"),
      new E.ImageManifestResolutionFailedError("image", cause, 404),
      new E.MultiArchImageError("image", "index"),
      new E.DockerConfigurationFailedError("details", { socket: "x" }),
      new E.DockerUnavailableError(cause),
      new E.ImagePullFailedError("image", cause),
      new E.ImagePullStreamMissingError("image"),
      new E.ImagePullProgressFailedError("image", cause),
      new E.ImageInspectionFailedError("image", cause),
      new E.ImageRuntimeMismatchError("image", ["sh"], "/"),
      new E.BuildTimedOutError(1, "out", "err"),
      new E.BuildCommandFailedError(1, "out", "err"),
      new E.BuildLogCollectionFailedError(cause),
      new E.BuildArtifactNotFoundError(),
      new E.BuildArtifactAmbiguousError(["a", "b"]),
      new E.BuildArtifactReadFailedError("a", cause),
      new E.BuildArtifactSnapshotFailedError("a", cause),
      new E.ContainerCreationFailedError(cause),
      new E.ContainerStartFailedError(cause),
      new E.ContainerWaitFailedError(cause),
      new E.ContainerKillFailedError(cause),
      new E.ContainerLogsFailedError(cause),
      new E.ContainerCleanupFailedError(cause),
      new E.EvidenceWriteFailedError("a", cause),
      new E.InvalidCliArgumentsError("details", { flag: "x" }),
    ];
    assertEquals(errors.length, Object.keys(E.Code).length);
    assertEquals(new Set(errors.map(({ code }) => code)).size, errors.length);
    for (const error of errors) {
      assertInstanceOf(error, ColibriError);
      assertEquals(error.domain, "verifiers");
      assertEquals(error.source, "@colibri/build-verification");
      assertEquals(error.name, `ColibriError ${error.code}`);
    }
  });
});
