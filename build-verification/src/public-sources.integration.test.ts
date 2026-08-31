import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  createDefaultVerificationPolicy,
  DEFAULT_BUILD_VERIFICATION_LIMITS,
} from "@/core/index.ts";
import {
  GitHubVerificationSourceProvider,
  HttpVerificationSourceProvider,
} from "@/providers/source/index.ts";
import { ContractBuildVerifier } from "@/verifier/index.ts";

const COMMIT = "13b9f51d184aabde23dec820e44eed056cf9690f";
const GITHUB_ARCHIVE_HASH =
  "99914f1ae0c24483e5269026954be74532976cf3182ff4a30c196f826f53aa5d";
const NORMAL_URL_HASH =
  "9da330a0820e2a65c2d178c953d473cc8d20d2763b10e6f0e0b354312681965b";
const RELEASE_ASSET_HASH =
  "4cf9f2741e6c465ffdb7c26f38056a59e2a2544b51f7cc128ef28337eeae4d8e";
const ARTIFACT_HASH =
  "ba789fe6627de52ebfbd5353f5eb6b7efef23d7e8633ab59051c1a22b2f00a88";
const IMAGE =
  "docker.io/stellar/stellar-cli@sha256:ccdebe3bd4af47e01f275c3da6caeb2752d02b06bc8bc1b3db534432498810c0";
const target = new URL(
  "../../_internal/build-verification/fixtures/public-source-hello-world.wasm",
  import.meta.url,
);
const policy = createDefaultVerificationPolicy().source;

describe("real public source providers", disableSanitizeConfig, () => {
  it("resolves an immutable GitHub commit archive and rebuilds it end to end", async () => {
    const result = await new ContractBuildVerifier({
      allowBuildNetwork: true,
      limits: { timeoutMs: 5 * 60 * 1000 },
    }).verify({
      mode: "outOfBand",
      target: { wasm: await Deno.readFile(target) },
      source: {
        type: "githubArchive",
        owner: "stellar",
        repository: "soroban-examples",
        revision: COMMIT,
        format: "tarGzip",
      },
      recipe: {
        image: IMAGE,
        options: [
          "--locked",
          "--manifest-path=hello_world/Cargo.toml",
          "--package=soroban-hello-world-contract",
          "--optimize",
        ],
        sourceSha256: GITHUB_ARCHIVE_HASH,
      },
    });

    assertEquals(result.status, "verified");
    assertEquals(result.evidence.source?.kind, "githubArchive");
    assertEquals(result.evidence.source?.requestedRevision, COMMIT);
    assertEquals(result.evidence.source?.resolvedRevision, COMMIT);
    assertEquals(result.evidence.source?.sha256, GITHUB_ARCHIVE_HASH);
    assertEquals(result.evidence.artifact?.sha256, ARTIFACT_HASH);
    assertEquals(result.evidence.execution?.networkEnabled, true);
  });

  it("resolves an immutable GitHub release asset with exact bytes and redacted locator evidence", async () => {
    const result = await new GitHubVerificationSourceProvider({ policy })
      .resolve({
        source: {
          type: "githubReleaseAsset",
          owner: "BurntSushi",
          repository: "ripgrep",
          tag: "14.1.1",
          asset: "ripgrep-14.1.1-x86_64-unknown-linux-musl.tar.gz",
        },
        strict: false,
        limits: DEFAULT_BUILD_VERIFICATION_LIMITS,
      });
    if (result.content !== "archive") throw new Error("expected archive");

    assertEquals(result.sha256, RELEASE_ASSET_HASH);
    assertEquals(result.size, 2_566_310);
    assertEquals(result.format, "tarGzip");
    assert(
      result.resolvedLocator?.includes("release-assets.githubusercontent.com"),
    );
    assert(!result.resolvedLocator?.includes("P60Gi"));
    assert(result.resolvedLocator?.includes("%3Credacted%3E"));
  });

  it("resolves a normal immutable HTTPS archive through a redirected extension-less URL", async () => {
    const result = await new HttpVerificationSourceProvider({ policy }).resolve(
      {
        source: {
          type: "url",
          url:
            `https://github.com/stellar/soroban-examples/archive/${COMMIT}.tar.gz`,
        },
        strict: false,
        limits: DEFAULT_BUILD_VERIFICATION_LIMITS,
      },
    );
    if (result.content !== "archive") throw new Error("expected archive");

    assertEquals(result.sha256, NORMAL_URL_HASH);
    assertEquals(result.size, 1_294_428);
    assertEquals(result.format, "tarGzip");
    assertEquals(
      result.resolvedLocator,
      `https://codeload.github.com/stellar/soroban-examples/tar.gz/${COMMIT}`,
    );
  });
});
