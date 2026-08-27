import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as E from "@/error.ts";
import { sha256Hex } from "@/hash.ts";
import { OfficialStellarImagePolicy, resolveContainerImage } from "@/image.ts";

const manifestResponse = async (
  manifest: Record<string, unknown> | string,
  headers: HeadersInit = {},
): Promise<{ reference: string; response: Response; bytes: Uint8Array }> => {
  const bytes = new TextEncoder().encode(
    typeof manifest === "string" ? manifest : JSON.stringify(manifest),
  );
  const digest = await sha256Hex(bytes);
  return {
    reference: `docker.io/stellar/stellar-cli@sha256:${digest}`,
    response: new Response(Uint8Array.from(bytes), { headers }),
    bytes,
  };
};

describe("container image resolution", () => {
  it("resolves one exact OCI manifest", async () => {
    const fixture = await manifestResponse({
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      architecture: "amd64",
      os: "linux",
    });
    const details = await resolveContainerImage(
      fixture.reference,
      () => Promise.resolve(fixture.response.clone()),
    );
    assertEquals(details.repository, "stellar/stellar-cli");
    assertEquals(details.architecture, "amd64");
    assertEquals(details.os, "linux");
    new OfficialStellarImagePolicy().validate(details);
  });

  it("uses the response content type when the manifest omits mediaType", async () => {
    const fixture = await manifestResponse({}, {
      "content-type":
        "application/vnd.oci.image.manifest.v1+json; charset=utf-8",
    });
    const details = await resolveContainerImage(
      fixture.reference,
      () => Promise.resolve(fixture.response.clone()),
    );
    assertEquals(
      details.mediaType,
      "application/vnd.oci.image.manifest.v1+json",
    );
  });

  it("authenticates against a Bearer registry challenge", async () => {
    const fixture = await manifestResponse({
      mediaType: "application/vnd.oci.image.manifest.v1+json",
    });
    const calls: string[] = [];
    const details = await resolveContainerImage(
      fixture.reference,
      (input, init) => {
        const headers = init && "headers" in init
          ? init.headers as HeadersInit
          : undefined;
        calls.push(
          `${input} ${new Headers(headers).get("authorization") ?? ""}`,
        );
        if (calls.length === 1) {
          return Promise.resolve(
            new Response("unauthorized", {
              status: 401,
              headers: {
                "www-authenticate":
                  'Bearer realm="https://auth.example/token",service="registry",scope="repository:stellar/stellar-cli:pull"',
              },
            }),
          );
        }
        if (calls.length === 2) {
          return Promise.resolve(
            Response.json({ access_token: "secret" }),
          );
        }
        return Promise.resolve(fixture.response.clone());
      },
    );
    assertEquals(details.digest, fixture.reference.split("@")[1]);
    assertEquals(calls.length, 3);
    assertEquals(calls[2].endsWith("Bearer secret"), true);
  });

  it("rejects invalid references, digests, indexes, and repository policy", async () => {
    await assertRejects(
      () => resolveContainerImage("stellar/stellar-cli:latest"),
      E.InvalidImageReferenceError,
    );
    const manifest = await manifestResponse({
      mediaType: "application/vnd.oci.image.manifest.v1+json",
    });
    const wrongReference = `docker.io/stellar/stellar-cli@sha256:${
      "0".repeat(64)
    }`;
    await assertRejects(
      () =>
        resolveContainerImage(
          wrongReference,
          () => Promise.resolve(manifest.response.clone()),
        ),
      E.ImageManifestResolutionFailedError,
    );
    const index = await manifestResponse({
      mediaType: "application/vnd.oci.image.index.v1+json",
    });
    await assertRejects(
      () =>
        resolveContainerImage(
          index.reference,
          () => Promise.resolve(index.response.clone()),
        ),
      E.MultiArchImageError,
    );
    assertThrows(() =>
      new OfficialStellarImagePolicy().validate({
        reference: manifest.reference.replace(
          "stellar/stellar-cli",
          "other/image",
        ),
        registry: "docker.io",
        repository: "other/image",
        digest: manifest.reference.split("@")[1],
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }), E.ImagePolicyRejectedError);
  });

  it("wraps registry transport, status, and document failures", async () => {
    const reference = `docker.io/stellar/stellar-cli@sha256:${"0".repeat(64)}`;
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () => Promise.reject(new Error("offline")),
        ),
      E.ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () => Promise.resolve(new Response("not found", { status: 404 })),
        ),
      E.ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () =>
            Promise.resolve(
              new Response(
                new ReadableStream({
                  cancel: () => Promise.reject(new Error("cancel failed")),
                }),
                { status: 500 },
              ),
            ),
        ),
      E.ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          () => Promise.resolve(new Response(null, { status: 401 })),
        ),
      E.ImageManifestResolutionFailedError,
    );
    const malformed = await manifestResponse("not-json");
    await assertRejects(
      () =>
        resolveContainerImage(
          malformed.reference,
          () => Promise.resolve(malformed.response.clone()),
        ),
      E.ImageManifestResolutionFailedError,
    );
  });

  it("wraps every Bearer token exchange failure", async () => {
    const reference = `docker.io/stellar/stellar-cli@sha256:${"0".repeat(64)}`;
    const unauthorized = () =>
      Promise.resolve(
        new Response(null, {
          status: 401,
          headers: {
            "www-authenticate": 'Bearer realm="https://auth.example/token"',
          },
        }),
      );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          (input) =>
            String(input).startsWith("https://auth")
              ? Promise.reject(new Error("offline"))
              : unauthorized(),
        ),
      E.ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          (input) =>
            String(input).startsWith("https://auth")
              ? Promise.resolve(new Response("failed", { status: 500 }))
              : unauthorized(),
        ),
      E.ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          (input) =>
            String(input).startsWith("https://auth")
              ? Promise.resolve(new Response("not-json"))
              : unauthorized(),
        ),
      E.ImageManifestResolutionFailedError,
    );
    await assertRejects(
      () =>
        resolveContainerImage(
          reference,
          (input) =>
            String(input).startsWith("https://auth")
              ? Promise.resolve(Response.json({}))
              : unauthorized(),
        ),
      E.ImageManifestResolutionFailedError,
    );
    let calls = 0;
    await assertRejects(() =>
      resolveContainerImage(reference, () => {
        calls += 1;
        if (calls === 1) return unauthorized();
        if (calls === 2) return Promise.resolve(Response.json({ token: "x" }));
        return Promise.reject(new Error("offline"));
      }), E.ImageManifestResolutionFailedError);
  });

  it("uses HTTP only for explicit localhost registries", async () => {
    const fixture = await manifestResponse({
      mediaType: "application/vnd.oci.image.manifest.v1+json",
    });
    const reference = fixture.reference.replace(
      "docker.io/stellar/stellar-cli",
      "localhost:5000/example/image",
    );
    let requested = "";
    await resolveContainerImage(reference, (input) => {
      requested = String(input);
      return Promise.resolve(fixture.response.clone());
    });
    assertEquals(requested.startsWith("http://localhost:5000/"), true);
  });

  it("uses HTTPS for other explicit registries and accepts a missing media type", async () => {
    const fixture = await manifestResponse({});
    const reference = fixture.reference.replace(
      "docker.io/stellar/stellar-cli",
      "ghcr.io/example/image",
    );
    let requested = "";
    const details = await resolveContainerImage(reference, (input) => {
      requested = String(input);
      return Promise.resolve(fixture.response.clone());
    });
    assertEquals(requested.startsWith("https://ghcr.io/"), true);
    assertEquals(details.mediaType, "");
  });

  it("rejects a Bearer challenge without an authentication realm", async () => {
    const reference = `docker.io/stellar/stellar-cli@sha256:${"0".repeat(64)}`;
    await assertRejects(
      () =>
        resolveContainerImage(reference, () =>
          Promise.resolve(
            new Response(null, {
              status: 401,
              headers: { "www-authenticate": 'Bearer service="registry"' },
            }),
          )),
      E.ImageManifestResolutionFailedError,
    );
  });
});
