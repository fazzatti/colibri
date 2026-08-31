import { assert, assertEquals, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { sha256Hex } from "@/core/comparison/index.ts";
import {
  ImageAttestationDecodingFailedError,
  ImageConfigDigestMismatchError,
  ImageConfigResolutionFailedError,
  ImageManifestDigestMismatchError,
  ImageManifestResolutionFailedError,
  ImageReferrerDigestMismatchError,
  ImageReferrersResolutionFailedError,
  InvalidImageReferenceError,
  MultiArchImageError,
} from "@/providers/image/error.ts";
import {
  OciContainerImageResolver,
  resolveContainerImage,
} from "@/providers/image/oci.ts";

const encode = (value: unknown): Uint8Array =>
  new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value),
  );

const digestOf = async (bytes: Uint8Array): Promise<string> =>
  `sha256:${await sha256Hex(bytes)}`;

type OciFixture = {
  readonly reference: string;
  readonly manifestDigest: string;
  readonly configDigest: string;
  readonly manifestBytes: Uint8Array;
  readonly configBytes: Uint8Array;
  readonly fetch: typeof fetch;
};

const createFixture = async (options: {
  readonly registry?: string;
  readonly repository?: string;
  readonly manifest?: Record<string, unknown>;
  readonly manifestMediaType?: string;
  readonly omitManifestMediaType?: boolean;
  readonly configMediaType?: string | null;
  readonly config?: Record<string, unknown> | string;
  readonly referrers?: Response | (() => Response);
} = {}): Promise<OciFixture> => {
  const configBytes = encode(
    options.config ?? {
      architecture: "amd64",
      os: "linux",
      config: {
        Entrypoint: ["stellar"],
        WorkingDir: "/source",
        Env: ["RUSTUP_TOOLCHAIN=1.88.0", "OTHER=value"],
        User: "1000",
      },
    },
  );
  const configDigest = await digestOf(configBytes);
  const manifestBytes = encode(
    options.manifest ?? {
      ...(options.omitManifestMediaType ? {} : {
        mediaType: options.manifestMediaType ??
          "application/vnd.oci.image.manifest.v1+json",
      }),
      config: {
        ...(options.configMediaType === null ? {} : {
          mediaType: options.configMediaType ??
            "application/vnd.oci.image.config.v1+json",
        }),
        digest: configDigest,
        size: configBytes.length,
      },
    },
  );
  const manifestDigest = await digestOf(manifestBytes);
  const registry = options.registry ?? "docker.io";
  const repository = options.repository ?? "stellar/stellar-cli";
  const reference = `${registry}/${repository}@${manifestDigest}`;
  const fetcher: typeof fetch = (request) => {
    const url = String(request);
    if (url.includes(`/manifests/${manifestDigest}`)) {
      return Promise.resolve(
        new Response(Uint8Array.from(manifestBytes), {
          headers: options.manifestMediaType
            ? { "content-type": options.manifestMediaType }
            : {},
        }),
      );
    }
    if (url.includes(`/blobs/${configDigest}`)) {
      return Promise.resolve(new Response(Uint8Array.from(configBytes)));
    }
    if (url.includes(`/referrers/${manifestDigest}`)) {
      const response = typeof options.referrers === "function"
        ? options.referrers()
        : options.referrers;
      return Promise.resolve(response ?? new Response(null, { status: 404 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  };
  return {
    reference,
    manifestDigest,
    configDigest,
    manifestBytes,
    configBytes,
    fetch: fetcher,
  };
};

describe("OCI image provider", () => {
  it("resolves exact manifest, config, toolchain, and missing-referrer facts", async () => {
    const fixture = await createFixture();
    const details = await resolveContainerImage(
      fixture.reference,
      fixture.fetch,
    );
    assertEquals(details.registry, "docker.io");
    assertEquals(details.repository, "stellar/stellar-cli");
    assertEquals(details.manifestDigest, fixture.manifestDigest);
    assertEquals(details.configDigest, fixture.configDigest);
    assertEquals(details.architecture, "amd64");
    assertEquals(details.os, "linux");
    assertEquals(details.entrypoint, ["stellar"]);
    assertEquals(details.workingDirectory, "/source");
    assertEquals(details.rustupToolchain, "1.88.0");
    assertEquals(details.referrers, []);
    assertEquals(details.provenance.present, false);
    assertEquals(details.sbom.present, false);
  });

  it("uses response media type fallback and explicit registry schemes", async () => {
    const localhost = await createFixture({
      registry: "localhost:5000",
      repository: "example/image",
      omitManifestMediaType: true,
      manifestMediaType: "application/vnd.oci.image.manifest.v1+json",
    });
    const requested: string[] = [];
    const details = await new OciContainerImageResolver({
      fetch: (request, init) => {
        requested.push(String(request));
        return localhost.fetch(request, init);
      },
    }).resolve(localhost.reference);
    assert(requested[0].startsWith("http://localhost:5000/"));
    assertEquals(
      details.manifestMediaType,
      "application/vnd.oci.image.manifest.v1+json",
    );

    const noMediaType = await createFixture({ omitManifestMediaType: true });
    assertEquals(
      (await resolveContainerImage(noMediaType.reference, noMediaType.fetch))
        .manifestMediaType,
      "",
    );

    const explicit = await createFixture({
      registry: "ghcr.io",
      repository: "example/image",
    });
    const urls: string[] = [];
    await new OciContainerImageResolver({
      fetch: (request, init) => {
        urls.push(String(request));
        return explicit.fetch(request, init);
      },
    }).resolve(explicit.reference);
    assert(urls[0].startsWith("https://ghcr.io/"));
  });

  it("authenticates once with either Bearer token response field", async () => {
    for (const field of ["token", "access_token"] as const) {
      const fixture = await createFixture();
      const calls: Array<{ url: string; authorization: string | null }> = [];
      let challenged = false;
      const fetcher: typeof fetch = (request, init) => {
        const url = String(request);
        const authorization = new Headers(
          (init as
            | { headers?: ConstructorParameters<typeof Headers>[0] }
            | undefined)?.headers,
        ).get("authorization");
        calls.push({ url, authorization });
        if (!challenged && url.includes("/manifests/")) {
          challenged = true;
          return Promise.resolve(
            new Response(null, {
              status: 401,
              headers: {
                "www-authenticate":
                  'Bearer realm="https://auth.example/token",service="registry",scope="repository:stellar/stellar-cli:pull"',
              },
            }),
          );
        }
        if (url.startsWith("https://auth.example")) {
          return Promise.resolve(Response.json({ [field]: "secret" }));
        }
        return fixture.fetch(request, init);
      };
      await resolveContainerImage(fixture.reference, fetcher);
      assert(
        calls.some(({ authorization }) => authorization === "Bearer secret"),
      );
    }
  });

  it("retries transient registry transport failures a bounded number of times", async () => {
    const fixture = await createFixture();
    let blobAttempts = 0;
    const details = await resolveContainerImage(
      fixture.reference,
      (request, init) => {
        if (String(request).includes("/blobs/") && blobAttempts++ === 0) {
          return Promise.reject(new Error("connection reset"));
        }
        return fixture.fetch(request, init);
      },
    );
    assertEquals(details.configDigest, fixture.configDigest);
    assertEquals(blobAttempts, 2);

    let attempts = 0;
    await assertRejects(
      () =>
        resolveContainerImage(fixture.reference, () => {
          attempts += 1;
          return Promise.reject(new Error("offline"));
        }),
      ImageManifestResolutionFailedError,
    );
    assertEquals(attempts, 3);
  });

  it("rejects invalid references, manifest status, decoding, digest, and indexes", async () => {
    await assertRejects(
      () =>
        new OciContainerImageResolver().resolve("stellar/stellar-cli:latest"),
      InvalidImageReferenceError,
    );
    const reference = `docker.io/stellar/stellar-cli@sha256:${"0".repeat(64)}`;
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () => Promise.reject(new Error("offline")),
        ),
      ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(reference, () =>
          Promise.resolve(
            new Response("missing", { status: 404 }),
          )),
      ImageManifestResolutionFailedError,
    );
    const malformedBytes = encode("not json");
    const malformedReference = `docker.io/stellar/stellar-cli@${await digestOf(
      malformedBytes,
    )}`;
    await assertRejects(
      () =>
        resolveContainerImage(malformedReference, () =>
          Promise.resolve(
            new Response(Uint8Array.from(malformedBytes)),
          )),
      ImageManifestResolutionFailedError,
    );
    const fixture = await createFixture();
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () =>
            Promise.resolve(
              new Response(Uint8Array.from(fixture.manifestBytes)),
            ),
        ),
      ImageManifestDigestMismatchError,
    );
    const index = await createFixture({
      manifest: {
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [],
      },
    });
    await assertRejects(
      () => resolveContainerImage(index.reference, index.fetch),
      MultiArchImageError,
    );
  });

  it("bounds manifest bytes and requires one valid config descriptor", async () => {
    const fixture = await createFixture();
    await assertRejects(
      () =>
        new OciContainerImageResolver({
          fetch: fixture.fetch,
          maxMetadataBytes: 1,
        }).resolve(fixture.reference),
      ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        new OciContainerImageResolver({
          fetch: () =>
            Promise.resolve(
              new Response("oversized", {
                headers: { "content-length": "100" },
              }),
            ),
          maxMetadataBytes: 1,
        }).resolve(fixture.reference),
      ImageManifestResolutionFailedError,
    );
    const emptyDigest = await digestOf(new Uint8Array());
    await assertRejects(
      () =>
        resolveContainerImage(
          `docker.io/stellar/stellar-cli@${emptyDigest}`,
          () => Promise.resolve(new Response(null)),
        ),
      ImageManifestResolutionFailedError,
    );
    const missing = await createFixture({
      manifest: { mediaType: "application/vnd.oci.image.manifest.v1+json" },
    });
    await assertRejects(
      () => resolveContainerImage(missing.reference, missing.fetch),
      ImageConfigResolutionFailedError,
    );
    const badDescriptor = await createFixture({
      manifest: {
        mediaType: "application/vnd.oci.image.manifest.v1+json",
        config: { digest: "bad" },
      },
    });
    await assertRejects(
      () => resolveContainerImage(badDescriptor.reference, badDescriptor.fetch),
      ImageConfigResolutionFailedError,
    );
  });

  it("keeps config transport, digest, and JSON failures distinct", async () => {
    const fixture = await createFixture();
    const statusFetch: typeof fetch = (request, init) =>
      String(request).includes("/blobs/")
        ? Promise.resolve(new Response(null, { status: 500 }))
        : fixture.fetch(request, init);
    await assertRejects(
      () => resolveContainerImage(fixture.reference, statusFetch),
      ImageConfigResolutionFailedError,
    );
    const wrongConfigFetch: typeof fetch = (request, init) =>
      String(request).includes("/blobs/")
        ? Promise.resolve(new Response("different"))
        : fixture.fetch(request, init);
    await assertRejects(
      () => resolveContainerImage(fixture.reference, wrongConfigFetch),
      ImageConfigDigestMismatchError,
    );
    const invalid = await createFixture({ config: "not-json" });
    await assertRejects(
      () => resolveContainerImage(invalid.reference, invalid.fetch),
      ImageConfigResolutionFailedError,
    );
    const defaultMediaType = await createFixture({ configMediaType: null });
    assertEquals(
      (await resolveContainerImage(
        defaultMediaType.reference,
        defaultMediaType.fetch,
      ))
        .configDigest,
      defaultMediaType.configDigest,
    );
    const noEnvironment = await createFixture({
      config: { architecture: "amd64", os: "linux" },
    });
    assertEquals(
      (await resolveContainerImage(
        noEnvironment.reference,
        noEnvironment.fetch,
      ))
        .environment,
      [],
    );
  });

  it("normalizes every Bearer challenge and exchange failure", async () => {
    const reference = `docker.io/stellar/stellar-cli@sha256:${"0".repeat(64)}`;
    const challenge = (header?: string) =>
      new Response(null, {
        status: 401,
        headers: header ? { "www-authenticate": header } : {},
      });
    await assertRejects(
      () =>
        resolveContainerImage(reference, () => Promise.resolve(challenge())),
      ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () => Promise.resolve(challenge('Bearer service="registry"')),
        ),
      ImageManifestResolutionFailedError,
    );
    const cancelFailure = new ReadableStream<Uint8Array>({
      cancel: () => {
        throw new Error("cancel failed");
      },
    });
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () => Promise.resolve(new Response(cancelFailure, { status: 401 })),
        ),
      ImageManifestResolutionFailedError,
    );
    const bearer = 'Bearer realm="https://auth.example/token"';
    const failures: Array<
      (request: string, call: number) => Promise<Response>
    > = [
      (request) =>
        request.startsWith("https://auth")
          ? Promise.reject(new Error("offline"))
          : Promise.resolve(challenge(bearer)),
      (request) =>
        request.startsWith("https://auth")
          ? Promise.resolve(new Response(null, { status: 500 }))
          : Promise.resolve(challenge(bearer)),
      (request) =>
        request.startsWith("https://auth")
          ? Promise.resolve(new Response("not-json"))
          : Promise.resolve(challenge(bearer)),
      (request) =>
        request.startsWith("https://auth")
          ? Promise.resolve(Response.json({}))
          : Promise.resolve(challenge(bearer)),
      (_request, call) =>
        call === 1
          ? Promise.resolve(challenge(bearer))
          : call === 2
          ? Promise.resolve(Response.json({ token: "secret" }))
          : Promise.reject(new Error("retry offline")),
    ];
    for (const failure of failures) {
      let call = 0;
      await assertRejects(
        () =>
          resolveContainerImage(reference, (request) => {
            call += 1;
            return failure(String(request), call);
          }),
        ImageManifestResolutionFailedError,
      );
    }
  });

  it("parses provenance and SBOM referrers without claiming signatures", async () => {
    const fixture = await createFixture();
    const provenance = encode({
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [
        { digest: { sha256: fixture.manifestDigest.slice(7) } },
        null,
        { digest: null },
        { digest: { sha256: 1 } },
      ],
      predicate: [{
        buildDefinition: {
          externalParameters: {
            sources: [
              "https://github.com/stellar/stellar-cli-docker",
              "https://example.com/not-collected",
            ],
          },
        },
      }],
    });
    const sbom = encode({
      predicateType: "https://spdx.dev/Document",
      subject: [],
      predicate: {},
    });
    const cyclonedx = encode({ subject: [], predicate: {} });
    const other = encode({ predicateType: "https://example.com/other" });
    const provenanceDigest = await digestOf(provenance);
    const sbomDigest = await digestOf(sbom);
    const otherDigest = await digestOf(other);
    const cyclonedxDigest = await digestOf(cyclonedx);
    const referrerManifest = encode({
      layers: [
        {
          mediaType: "application/vnd.in-toto+json",
          digest: provenanceDigest,
          annotations: {
            "in-toto.io/predicate-type": "https://slsa.dev/provenance/v1",
          },
        },
        {
          mediaType: "application/octet-stream",
          digest: sbomDigest,
          annotations: {
            "in-toto.io/predicate-type": "https://spdx.dev/Document",
          },
        },
        {
          mediaType: "application/vnd.in-toto+json",
          digest: otherDigest,
        },
        {
          digest: cyclonedxDigest,
          annotations: {
            "in-toto.io/predicate-type": "https://cyclonedx.org/bom",
          },
        },
        { mediaType: "application/octet-stream", digest: otherDigest },
      ],
    });
    const referrerDigest = await digestOf(referrerManifest);
    const indexBytes = encode({
      manifests: [
        {},
        {
          digest: referrerDigest,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          artifactType: "application/vnd.in-toto+json",
          annotations: { purpose: "attestation" },
        },
      ],
    });
    const fetcher: typeof fetch = (request, init) => {
      const url = String(request);
      if (url.includes(`/referrers/${fixture.manifestDigest}`)) {
        return Promise.resolve(new Response(Uint8Array.from(indexBytes)));
      }
      if (url.includes(`/manifests/${referrerDigest}`)) {
        return Promise.resolve(new Response(Uint8Array.from(referrerManifest)));
      }
      const blobs = new Map([
        [provenanceDigest, provenance],
        [sbomDigest, sbom],
        [otherDigest, other],
        [cyclonedxDigest, cyclonedx],
      ]);
      for (const [digest, bytes] of blobs) {
        if (url.includes(`/blobs/${digest}`)) {
          return Promise.resolve(new Response(Uint8Array.from(bytes)));
        }
      }
      return fixture.fetch(request, init);
    };
    const details = await resolveContainerImage(fixture.reference, fetcher);
    assertEquals(details.referrers.length, 1);
    assertEquals(details.provenance.present, true);
    assertEquals(details.provenance.parsed, true);
    assertEquals(details.provenance.signatureVerified, false);
    assertEquals(details.provenance.subjectDigests, [
      fixture.manifestDigest.slice(7),
    ]);
    assertEquals(details.provenance.sourceRepositories, [
      "https://github.com/stellar/stellar-cli-docker",
    ]);
    assertEquals(details.sbom, {
      present: true,
      formats: ["spdx", "cyclonedx"],
    });
  });

  it("handles empty referrer indexes, empty manifests, and transport failures", async () => {
    const empty = await createFixture({ referrers: Response.json({}) });
    assertEquals(
      (await resolveContainerImage(empty.reference, empty.fetch)).referrers,
      [],
    );

    const fixture = await createFixture();
    const emptyManifest = encode({});
    const emptyManifestDigest = await digestOf(emptyManifest);
    const index = Response.json({
      manifests: [{
        digest: emptyManifestDigest,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }],
    });
    const fetcher: typeof fetch = (request, init) => {
      const url = String(request);
      if (url.includes("/referrers/")) return Promise.resolve(index.clone());
      if (url.includes(`/manifests/${emptyManifestDigest}`)) {
        return Promise.resolve(new Response(Uint8Array.from(emptyManifest)));
      }
      return fixture.fetch(request, init);
    };
    assertEquals(
      (await resolveContainerImage(fixture.reference, fetcher)).referrers
        .length,
      1,
    );

    await assertRejects(
      () =>
        resolveContainerImage(
          fixture.reference,
          (request, init) =>
            String(request).includes("/referrers/")
              ? Promise.reject(new Error("referrer endpoint offline"))
              : fixture.fetch(request, init),
        ),
      ImageReferrersResolutionFailedError,
    );
  });

  it("rejects malformed or excessive referrer documents", async () => {
    const fixture = await createFixture();
    const variants: Array<{
      response: Response;
      maximum?: number;
    }> = [
      { response: new Response(null, { status: 500 }) },
      { response: new Response("not-json") },
      {
        response: Response.json({ manifests: [{}, {}] }),
        maximum: 1,
      },
    ];
    for (const variant of variants) {
      const fetcher: typeof fetch = (request, init) =>
        String(request).includes("/referrers/")
          ? Promise.resolve(variant.response.clone())
          : fixture.fetch(request, init);
      await assertRejects(
        () =>
          new OciContainerImageResolver({
            fetch: fetcher,
            maxReferrers: variant.maximum,
          }).resolve(fixture.reference),
        ImageReferrersResolutionFailedError,
      );
    }
  });

  it("rejects referrer manifest, digest, and attestation blob failures", async () => {
    const fixture = await createFixture();
    const referrerBytes = encode({ layers: [] });
    const referrerDigest = await digestOf(referrerBytes);
    const index = Response.json({
      manifests: [{
        digest: referrerDigest,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }],
    });
    const referrerFetch = (
      manifestResponse: Response,
    ): typeof fetch =>
    (request, init) => {
      const url = String(request);
      if (url.includes("/referrers/")) return Promise.resolve(index.clone());
      if (url.includes(`/manifests/${referrerDigest}`)) {
        return Promise.resolve(manifestResponse.clone());
      }
      return fixture.fetch(request, init);
    };
    await assertRejects(
      () =>
        resolveContainerImage(
          fixture.reference,
          referrerFetch(new Response(null, { status: 500 })),
        ),
      ImageReferrersResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          fixture.reference,
          referrerFetch(new Response("different")),
        ),
      ImageReferrerDigestMismatchError,
    );

    const malformedManifest = encode("not-json");
    const malformedDigest = await digestOf(malformedManifest);
    const malformedIndex = Response.json({
      manifests: [{
        digest: malformedDigest,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }],
    });
    const malformedFetcher: typeof fetch = (request, init) => {
      const url = String(request);
      if (url.includes("/referrers/")) {
        return Promise.resolve(malformedIndex.clone());
      }
      if (url.includes(`/manifests/${malformedDigest}`)) {
        return Promise.resolve(
          new Response(Uint8Array.from(malformedManifest)),
        );
      }
      return fixture.fetch(request, init);
    };
    await assertRejects(
      () => resolveContainerImage(fixture.reference, malformedFetcher),
      ImageAttestationDecodingFailedError,
    );

    const badStatement = encode("not-json");
    const badStatementDigest = await digestOf(badStatement);
    const layerManifest = encode({
      layers: [{
        mediaType: "application/vnd.in-toto+json",
        digest: badStatementDigest,
      }],
    });
    const layerManifestDigest = await digestOf(layerManifest);
    const layerIndex = Response.json({
      manifests: [{
        digest: layerManifestDigest,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }],
    });
    const layerFetcher: typeof fetch = (request, init) => {
      const url = String(request);
      if (url.includes("/referrers/")) {
        return Promise.resolve(layerIndex.clone());
      }
      if (url.includes(`/manifests/${layerManifestDigest}`)) {
        return Promise.resolve(new Response(Uint8Array.from(layerManifest)));
      }
      if (url.includes(`/blobs/${badStatementDigest}`)) {
        return Promise.resolve(new Response(Uint8Array.from(badStatement)));
      }
      return fixture.fetch(request, init);
    };
    await assertRejects(
      () => resolveContainerImage(fixture.reference, layerFetcher),
      ImageAttestationDecodingFailedError,
    );

    const statement = encode({
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [],
      predicate: {},
    });
    const statementDigest = await digestOf(statement);
    const blobManifest = encode({
      layers: [{
        digest: statementDigest,
        annotations: {
          "in-toto.io/predicate-type": "https://slsa.dev/provenance/v1",
        },
      }],
    });
    const blobManifestDigest = await digestOf(blobManifest);
    const blobIndex = Response.json({
      manifests: [{
        digest: blobManifestDigest,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }],
    });
    const blobFetcher = (blob: Response): typeof fetch => (request, init) => {
      const url = String(request);
      if (url.includes("/referrers/")) {
        return Promise.resolve(blobIndex.clone());
      }
      if (url.includes(`/manifests/${blobManifestDigest}`)) {
        return Promise.resolve(new Response(Uint8Array.from(blobManifest)));
      }
      if (url.includes(`/blobs/${statementDigest}`)) {
        return Promise.resolve(blob.clone());
      }
      return fixture.fetch(request, init);
    };
    await assertRejects(
      () =>
        resolveContainerImage(
          fixture.reference,
          blobFetcher(new Response(null, { status: 500 })),
        ),
      ImageReferrersResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          fixture.reference,
          blobFetcher(new Response("different")),
        ),
      ImageReferrerDigestMismatchError,
    );
  });
});
