import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  decodeGitHubReleaseAsset,
  decodeGitHubRevision,
} from "@/providers/source/github.ts";
import {
  GitHubCommitShaMissingError,
  GitHubReleaseAssetMissingError,
  GitHubReleaseAssetResolutionFailedError,
  GitHubRevisionResolutionFailedError,
} from "@/providers/source/error.ts";

describe("GitHub response boundaries", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  it("distinguishes malformed commit JSON from a missing immutable SHA", () => {
    assertThrows(
      () => decodeGitHubRevision(bytes("{"), "a/b", "main"),
      GitHubRevisionResolutionFailedError,
    );
    for (const text of ["{}", '{"sha":"main"}']) {
      assertThrows(
        () => decodeGitHubRevision(bytes(text), "a/b", "main"),
        GitHubCommitShaMissingError,
      );
    }
    const sha = "a".repeat(40);
    assertEquals(
      decodeGitHubRevision(bytes(JSON.stringify({ sha })), "a/b", "main"),
      sha,
    );
  });
  it("distinguishes malformed release JSON from a missing named asset", () => {
    assertThrows(
      () => decodeGitHubReleaseAsset(bytes("{"), "a/b", "v1", "src.zip"),
      GitHubReleaseAssetResolutionFailedError,
    );
    for (
      const text of ["{}", '{"assets":[]}', '{"assets":[{"name":"src.zip"}]}']
    ) {
      assertThrows(
        () => decodeGitHubReleaseAsset(bytes(text), "a/b", "v1", "src.zip"),
        GitHubReleaseAssetMissingError,
      );
    }
    assertEquals(
      decodeGitHubReleaseAsset(
        bytes(
          '{"assets":[{"name":"other"},{"name":"src.zip","url":"https://api.github.com/repos/a/b/releases/assets/1"}]}',
        ),
        "a/b",
        "v1",
        "src.zip",
      ),
      "https://api.github.com/repos/a/b/releases/assets/1",
    );
  });
});
