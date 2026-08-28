import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  ArchiveLimitExceededError,
  UnsafeArchiveEntryError,
} from "../../archive/error.ts";
import {
  acceptedPolicyDecision,
  rejectedPolicyDecision,
  TEST_LIMITS,
  testTar,
} from "../../testing.test.ts";
import type {
  SourceAddressResolver,
  SourceHttpResponse,
  SourceHttpTransport,
  SourceHttpTransportInput,
  VerificationSourceProviderInput,
} from "./types.ts";
import { ArchiveVerificationSourceProvider } from "./archive.ts";
import { FileVerificationSourceProvider } from "./file.ts";
import {
  buildPinnedSourceRequestOptions,
  collectBoundedSourceResponse,
  DenoSourceAddressResolver,
  HttpVerificationSourceProvider,
  normalizeSourceResponseHeaders,
  PinnedAddressHttpTransport,
  redactSourceUrl,
  retrievePinnedHttpResource,
} from "./http.ts";
import { GitHubVerificationSourceProvider } from "./github.ts";
import { DefaultVerificationSourceProvider } from "./router.ts";
import {
  GitHubReleaseAssetResolutionFailedError,
  GitHubRevisionResolutionFailedError,
  LocalSourceArchiveReadFailedError,
  SourceDnsResolutionFailedError,
  SourceDownloadFailedError,
  SourcePolicyRejectedError,
  SourceRedirectLimitExceededError,
  SourceRedirectLocationMissingError,
  SourceRequestTimedOutError,
  SourceResponseReadFailedError,
  UnsupportedSourceError,
} from "./error.ts";
import type { SourceRetrievalPolicy } from "../../core/index.ts";

const directories: string[] = [];
const temporaryDirectory = async (): Promise<string> => {
  const path = await Deno.makeTempDir();
  directories.push(path);
  return path;
};

afterEach(async () => {
  for (const path of directories.splice(0)) {
    await Deno.remove(path, { recursive: true }).catch(() => undefined);
  }
});

const bytes = testTar([
  { path: "source/", type: "5" },
  { path: "source/Cargo.toml", value: "[workspace]" },
]);

const input = (
  source: VerificationSourceProviderInput["source"],
  overrides: Partial<VerificationSourceProviderInput> = {},
): VerificationSourceProviderInput => ({
  source,
  strict: true,
  limits: TEST_LIMITS,
  ...overrides,
});

class FixedAddressResolver implements SourceAddressResolver {
  readonly calls: string[] = [];
  constructor(readonly addresses = ["93.184.216.34"]) {}
  resolve(hostname: string): Promise<readonly string[]> {
    this.calls.push(hostname);
    return Promise.resolve(this.addresses);
  }
}

class QueueTransport implements SourceHttpTransport {
  readonly calls: SourceHttpTransportInput[] = [];
  constructor(
    readonly responses: Array<SourceHttpResponse | Error> = [],
  ) {}
  request(request: SourceHttpTransportInput): Promise<SourceHttpResponse> {
    this.calls.push(request);
    const response = this.responses.shift();
    if (response instanceof Error) return Promise.reject(response);
    if (!response) throw new Error("Missing queued source response");
    return Promise.resolve(response);
  }
}

const acceptedPolicy: SourceRetrievalPolicy = {
  evaluate: () => acceptedPolicyDecision("source.test"),
};

describe("source providers", () => {
  it("copies and hashes bounded in-memory archive bytes", async () => {
    const original = Uint8Array.from(bytes);
    const result = await new ArchiveVerificationSourceProvider().resolve(input({
      type: "archive",
      name: "source.tar",
      bytes: original,
    }));
    original[0] ^= 1;
    assertEquals(result.content, "archive");
    if (result.content !== "archive") throw new Error("expected archive");
    assertEquals(result.format, "tar");
    assertEquals(result.bytes[0], bytes[0]);
    await assertRejects(
      () =>
        new ArchiveVerificationSourceProvider().resolve(input({
          type: "archive",
          name: "source.tar",
          bytes,
        }, { limits: { ...TEST_LIMITS, maxArchiveBytes: 1 } })),
      ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        new ArchiveVerificationSourceProvider().resolve(
          input({ type: "path", path: "." }),
        ),
      TypeError,
    );
  });

  it("resolves local archives and out-of-band directories safely", async () => {
    const root = await temporaryDirectory();
    const path = `${root}/source.tar`;
    await Deno.writeFile(path, bytes);
    const provider = new FileVerificationSourceProvider();
    const archive = await provider.resolve(input({ type: "path", path }));
    assertEquals(archive.content, "archive");
    if (archive.content !== "archive") throw new Error("expected archive");
    assertEquals(archive.format, "tar");
    const directory = await provider.resolve(input(
      { type: "path", path: root },
      { strict: false },
    ));
    assertEquals(directory.content, "directory");
    await assertRejects(
      () => provider.resolve(input({ type: "path", path: root })),
      UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        provider.resolve(input({ type: "path", path }, {
          limits: { ...TEST_LIMITS, maxArchiveBytes: 1 },
        })),
      ArchiveLimitExceededError,
    );
  });

  it("rejects missing, symbolic, special, and wrong-provider local sources", async () => {
    const root = await temporaryDirectory();
    const link = `${root}/link`;
    await Deno.symlink(root, link);
    const provider = new FileVerificationSourceProvider();
    await assertRejects(
      () =>
        provider.resolve(input({ type: "path", path: "/definitely/missing" })),
      UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        provider.resolve(
          input({ type: "path", path: link }, { strict: false }),
        ),
      UnsafeArchiveEntryError,
    );
    await assertRejects(
      () =>
        provider.resolve(input({ type: "url", url: "https://example.com" })),
      TypeError,
    );

    const socketPath = `${root}/source.socket`;
    const socket = Deno.listen({ transport: "unix", path: socketPath });
    try {
      await assertRejects(
        () => provider.resolve(input({ type: "path", path: socketPath })),
        UnsupportedSourceError,
      );
    } finally {
      socket.close();
    }

    const unreadable = `${root}/unreadable.tar`;
    await Deno.writeFile(unreadable, bytes, { mode: 0o000 });
    try {
      await assertRejects(
        () => provider.resolve(input({ type: "path", path: unreadable })),
        LocalSourceArchiveReadFailedError,
      );
    } finally {
      await Deno.chmod(unreadable, 0o600);
    }
  });

  it("redacts source URL credentials and invalid locators", () => {
    assertEquals(
      redactSourceUrl(
        "https://user:password@example.com/a?token=visible&sig=secret&jwt=secret&page=1",
      ),
      "https://example.com/a?token=%3Credacted%3E&sig=%3Credacted%3E&jwt=%3Credacted%3E&page=1",
    );
    assertEquals(redactSourceUrl("not a URL"), "<invalid-url>");
    assertEquals(
      normalizeSourceResponseHeaders({
        missing: undefined,
        list: ["one", "two"],
        value: "three",
      }),
      { list: "one, two", value: "three" },
    );

    const pinned = buildPinnedSourceRequestOptions({
      url: "https://[2001:db8::1]/source.tar?download=1",
      headers: { Host: "attacker.example", accept: "application/x-tar" },
      approvedAddresses: ["2001:db8::2"],
      timeoutMs: 100,
      maxBytes: 100,
    }, "2001:db8::2");
    assertEquals(pinned.useHttps, true);
    assertEquals(pinned.options, {
      protocol: "https:",
      hostname: "2001:db8::1",
      port: undefined,
      path: "/source.tar?download=1",
      method: "GET",
      headers: {
        accept: "application/x-tar",
        host: "[2001:db8::1]",
      },
    });
    assertEquals(
      buildPinnedSourceRequestOptions({
        url: "https://example.com/source.tar",
        headers: {},
        approvedAddresses: ["192.0.2.1"],
        timeoutMs: 100,
        maxBytes: 100,
      }, "192.0.2.1").options.servername,
      "example.com",
    );
  });

  it("retrieves through pinned addresses and revalidates every redirect", async () => {
    const transport = new QueueTransport([
      {
        status: 302,
        headers: { location: "/final.tar" },
        bytes: new Uint8Array(),
      },
      { status: 200, headers: { "content-type": "application/x-tar" }, bytes },
    ]);
    const resolver = new FixedAddressResolver();
    const resource = await retrievePinnedHttpResource({
      url: "https://user:password@example.com/start.tar",
      limits: TEST_LIMITS,
      policy: acceptedPolicy,
      transport,
      addressResolver: resolver,
      headers: (url) => ({ host: url.hostname }),
    });
    assertEquals(resource.requestedUrl, "https://example.com/start.tar");
    assertEquals(resource.finalUrl, "https://example.com/final.tar");
    assertEquals(resolver.calls, ["example.com", "example.com"]);
    assertEquals(transport.calls.map(({ headers }) => headers), [
      { host: "example.com" },
      { host: "example.com" },
    ]);
  });

  it("normalizes every pinned retrieval failure occurrence", async () => {
    const base = {
      limits: TEST_LIMITS,
      policy: acceptedPolicy,
      addressResolver: new FixedAddressResolver(),
    };
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "not a URL",
          transport: new QueueTransport(),
        }),
      SourceDownloadFailedError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "https://example.com/a.tar",
          policy: { evaluate: () => rejectedPolicyDecision("source.test") },
          transport: new QueueTransport(),
        }),
      SourcePolicyRejectedError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "https://example.com/a.tar",
          transport: new QueueTransport([new Error("offline")]),
        }),
      SourceDownloadFailedError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "https://example.com/a.tar",
          transport: new QueueTransport([
            { status: 302, headers: {}, bytes: new Uint8Array() },
          ]),
        }),
      SourceRedirectLocationMissingError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          limits: { ...TEST_LIMITS, maxRedirects: 0 },
          url: "https://example.com/a.tar",
          transport: new QueueTransport([
            {
              status: 302,
              headers: { location: "/again" },
              bytes: new Uint8Array(),
            },
          ]),
        }),
      SourceRedirectLimitExceededError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "https://example.com/a.tar",
          transport: new QueueTransport([
            { status: 404, headers: {}, bytes: new Uint8Array() },
          ]),
        }),
      SourceDownloadFailedError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "https://example.com/a.tar",
          transport: new QueueTransport([
            new SourceRequestTimedOutError("https://example.com", 1),
          ]),
        }),
      SourceRequestTimedOutError,
    );
    await assertRejects(
      () =>
        retrievePinnedHttpResource({
          ...base,
          url: "https://example.com/a.tar",
          transport: new QueueTransport([
            new ArchiveLimitExceededError("archive byte", 2, 1),
          ]),
        }),
      ArchiveLimitExceededError,
    );
    assertEquals(
      new SourcePolicyRejectedError("https://example.com", []).details,
      "The source request was not accepted.",
    );
  });

  it("uses the real DNS-pinned HTTP transport with bounded redirects and bodies", async () => {
    const server = createServer((request, response) => {
      request.on("error", () => undefined);
      response.on("error", () => undefined);
      switch (request.url) {
        case "/redirect":
          response.writeHead(302, {
            location: "/ok?redirected=true",
            "x-list": ["one", "two"],
          });
          response.end();
          return;
        default:
          response.writeHead(200, {
            "content-type": "application/x-tar",
            "set-cookie": ["a=1", "b=2"],
          });
          response.end(bytes);
      }
    });
    server.on("clientError", (_error, socket) => socket.destroy());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const port = (server.address() as AddressInfo).port;
    const transport = new PinnedAddressHttpTransport();
    const request = (
      path: string,
      overrides: Partial<SourceHttpTransportInput> = {},
    ) =>
      transport.request({
        url: `http://localhost:${port}${path}`,
        headers: { "x-test": "true" },
        approvedAddresses: ["127.0.0.1"],
        timeoutMs: 1_000,
        maxBytes: TEST_LIMITS.maxArchiveBytes,
        ...overrides,
      });
    try {
      const ok = await request("/ok?query=true");
      assertEquals(ok.status, 200);
      assertEquals(ok.bytes, bytes);
      assertEquals(ok.headers["set-cookie"], "a=1, b=2");
      assertEquals((await request("/redirect")).status, 302);
      assertEquals(
        (await request("/ok", {
          approvedAddresses: ["::1", "127.0.0.1"],
        })).status,
        200,
      );
      await assertRejects(
        () =>
          transport.request({
            url: `http://localhost:${port}/ok`,
            headers: {},
            approvedAddresses: [],
            timeoutMs: 100,
            maxBytes: 100,
          }),
        SourceDownloadFailedError,
      );
      await assertRejects(
        () =>
          transport.request({
            url: "http://localhost:1/unavailable",
            headers: {},
            approvedAddresses: ["127.0.0.1", "127.0.0.1"],
            timeoutMs: 100,
            maxBytes: 100,
          }),
        SourceDownloadFailedError,
      );
      await assertRejects(
        () =>
          transport.request({
            url: "https://[::1]:1/unavailable",
            headers: {},
            approvedAddresses: ["::1"],
            timeoutMs: 100,
            maxBytes: 100,
          }),
        SourceDownloadFailedError,
      );
      await assertRejects(
        () =>
          transport.request({
            url: "https://localhost:1/unavailable",
            headers: {},
            approvedAddresses: ["127.0.0.1"],
            timeoutMs: 100,
            maxBytes: 100,
          }),
        SourceDownloadFailedError,
      );
      await assertRejects(
        () =>
          transport.request({
            url: "https://[::1]/unavailable",
            headers: {},
            approvedAddresses: ["::1"],
            timeoutMs: 20,
            maxBytes: 100,
          }),
        SourceDownloadFailedError,
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
      );
    }

    const requestRawResponse = async (
      responseText: string,
      maxBytes: number,
    ): Promise<SourceHttpResponse> => {
      const rawListener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
      const rawPort = (rawListener.addr as Deno.NetAddr).port;
      const served = (async () => {
        const connection = await rawListener.accept();
        try {
          await connection.read(new Uint8Array(1024));
          await connection.write(new TextEncoder().encode(responseText));
        } finally {
          connection.close();
        }
      })().catch(() => undefined);
      try {
        return await transport.request({
          url: `http://localhost:${rawPort}/bounded`,
          headers: {},
          approvedAddresses: ["127.0.0.1"],
          timeoutMs: 100,
          maxBytes,
        });
      } finally {
        await served;
        rawListener.close();
      }
    };
    await assertRejects(
      () =>
        requestRawResponse(
          `HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n${
            "x".repeat(100)
          }`,
          1,
        ),
      ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        collectBoundedSourceResponse(
          (async function* () {
            yield new Uint8Array([1]);
            throw new Error("stream failed");
          })(),
          100,
        ),
      Error,
      "stream failed",
    );
    await assertRejects(
      () =>
        requestRawResponse(
          "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n2\r\nab\r\n2\r\ncd\r\n0\r\n\r\n",
          3,
        ),
      ArchiveLimitExceededError,
    );

    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const timeoutPort = (listener.addr as Deno.NetAddr).port;
    const accepted = (async () => {
      const connection = await listener.accept();
      try {
        await connection.read(new Uint8Array(1024));
        await new Promise((resolve) => setTimeout(resolve, 50));
      } finally {
        connection.close();
      }
    })().catch((cause) => {
      if (cause instanceof Deno.errors.Interrupted) return;
      throw cause;
    });
    try {
      await assertRejects(
        () =>
          transport.request({
            url: `http://localhost:${timeoutPort}/slow`,
            headers: {},
            approvedAddresses: ["127.0.0.1"],
            timeoutMs: 10,
            maxBytes: 100,
          }),
        SourceRequestTimedOutError,
      );
      await accepted;
    } finally {
      listener.close();
    }
  });

  it("turns successful HTTP responses into exact archive sources", async () => {
    const provider = new HttpVerificationSourceProvider({
      policy: acceptedPolicy,
      transport: new QueueTransport([
        {
          status: 200,
          headers: { "content-type": "application/x-tar" },
          bytes,
        },
      ]),
      addressResolver: new FixedAddressResolver(),
      headers: { "x-test": "true" },
    });
    const result = await provider.resolve(input({
      type: "url",
      url: "https://example.com/source.tar",
    }, { provenanceKind: "metadataUrl" }));
    assertEquals(result.kind, "metadataUrl");
    if (result.content !== "archive") throw new Error("expected archive");
    assertEquals(result.format, "tar");
    await assertRejects(
      () => provider.resolve(input({ type: "path", path: "." })),
      TypeError,
    );
    const invalidName = new HttpVerificationSourceProvider({
      policy: acceptedPolicy,
      transport: new QueueTransport([
        { status: 200, headers: {}, bytes },
      ]),
      addressResolver: new FixedAddressResolver(),
    });
    await assertRejects(
      () =>
        invalidName.resolve(input({
          type: "url",
          url: "https://example.com/source.unknown",
        })),
      SourceResponseReadFailedError,
    );
  });

  it("retains the requested archive format when a redirect target omits its extension", async () => {
    const provider = new HttpVerificationSourceProvider({
      policy: acceptedPolicy,
      transport: new QueueTransport([
        {
          status: 302,
          headers: { location: "https://objects.example.com/immutable" },
          bytes: new Uint8Array(),
        },
        { status: 200, headers: {}, bytes },
      ]),
      addressResolver: new FixedAddressResolver(),
    });
    const result = await provider.resolve(input({
      type: "url",
      url: "https://example.com/source.tar.gz",
    }));
    if (result.content !== "archive") throw new Error("expected archive");
    assertEquals(result.format, "tarGzip");
    assertEquals(
      result.resolvedLocator,
      "https://objects.example.com/immutable",
    );
  });

  it("resolves GitHub revisions while keeping tokens on api.github.com", async () => {
    const sha = "b".repeat(40);
    const transport = new QueueTransport([
      {
        status: 200,
        headers: { "content-type": "application/json" },
        bytes: new TextEncoder().encode(JSON.stringify({ sha })),
      },
      {
        status: 302,
        headers: { location: "https://objects.example.com/archive" },
        bytes: new Uint8Array(),
      },
      { status: 200, headers: { "content-type": "application/gzip" }, bytes },
    ]);
    const result = await new GitHubVerificationSourceProvider({
      policy: acceptedPolicy,
      token: "private-token",
      transport,
      addressResolver: new FixedAddressResolver(),
    }).resolve(input({
      type: "githubArchive",
      owner: "stellar",
      repository: "example",
      revision: "main",
      format: "tarGzip",
    }));
    if (result.content !== "archive") throw new Error("expected archive");
    assertEquals(result.resolvedRevision, sha);
    assertEquals(result.requestedRevision, "main");
    assert(
      String(transport.calls[0].headers.authorization).includes(
        "private-token",
      ),
    );
    assert(
      String(transport.calls[1].headers.authorization).includes(
        "private-token",
      ),
    );
    assertEquals(transport.calls[2].headers.authorization, undefined);
  });

  it("resolves an exact GitHub release asset through the API", async () => {
    const transport = new QueueTransport([
      {
        status: 200,
        headers: {},
        bytes: new TextEncoder().encode(JSON.stringify({
          assets: [{
            name: "source.zip",
            url:
              "https://api.github.com/repos/stellar/example/releases/assets/1",
          }],
        })),
      },
      { status: 200, headers: { "content-type": "application/zip" }, bytes },
    ]);
    const result = await new GitHubVerificationSourceProvider({
      policy: acceptedPolicy,
      token: "token",
      transport,
      addressResolver: new FixedAddressResolver(),
    }).resolve(input({
      type: "githubReleaseAsset",
      owner: "stellar",
      repository: "example",
      tag: "v1",
      asset: "source.zip",
    }));
    if (result.content !== "archive") throw new Error("expected archive");
    assertEquals(result.kind, "githubReleaseAsset");
    assertEquals(result.format, "zip");
    assertEquals(transport.calls[1].headers.accept, "application/octet-stream");
  });

  it("rejects invalid GitHub requests and unresolved API responses", async () => {
    const options = {
      policy: acceptedPolicy,
      transport: new QueueTransport(),
      addressResolver: new FixedAddressResolver(),
    };
    const provider = new GitHubVerificationSourceProvider(options);
    await assertRejects(
      () =>
        provider.resolve(input({ type: "url", url: "https://example.com" })),
      TypeError,
    );
    await assertRejects(
      () =>
        provider.resolve(input({
          type: "githubArchive",
          owner: "bad/owner",
          repository: "repo",
          revision: "main",
        })),
      UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        provider.resolve(input({
          type: "githubArchive",
          owner: "stellar",
          repository: "repo",
          revision: "",
        })),
      UnsupportedSourceError,
    );
    const badRevision = new GitHubVerificationSourceProvider({
      ...options,
      transport: new QueueTransport([
        { status: 200, headers: {}, bytes: new TextEncoder().encode("{}") },
      ]),
    });
    await assertRejects(
      () =>
        badRevision.resolve(input({
          type: "githubArchive",
          owner: "stellar",
          repository: "repo",
          revision: "main",
        })),
      GitHubRevisionResolutionFailedError,
    );
    const badRelease = new GitHubVerificationSourceProvider({
      ...options,
      transport: new QueueTransport([
        {
          status: 200,
          headers: {},
          bytes: new TextEncoder().encode(JSON.stringify({ assets: [] })),
        },
      ]),
    });
    await assertRejects(
      () =>
        badRelease.resolve(input({
          type: "githubReleaseAsset",
          owner: "stellar",
          repository: "repo",
          tag: "v1",
          asset: "missing.zip",
        })),
      GitHubReleaseAssetResolutionFailedError,
    );
    await assertRejects(
      () =>
        provider.resolve(input({
          type: "githubReleaseAsset",
          owner: "stellar",
          repository: "repo",
          tag: "",
          asset: "bad/name",
        })),
      UnsupportedSourceError,
    );

    for (
      const source of [
        {
          type: "githubArchive" as const,
          owner: "stellar",
          repository: "repo",
          revision: "main",
        },
        {
          type: "githubReleaseAsset" as const,
          owner: "stellar",
          repository: "repo",
          tag: "v1",
          asset: "source.tar",
        },
      ]
    ) {
      await assertRejects(
        () =>
          new GitHubVerificationSourceProvider({
            ...options,
            policy: { evaluate: () => rejectedPolicyDecision("source.test") },
          }).resolve(input(source)),
        SourcePolicyRejectedError,
      );
    }
  });

  it("selects ZIP revision archives and strips release API headers after redirects", async () => {
    const sha = "e".repeat(40);
    const zipTransport = new QueueTransport([
      {
        status: 200,
        headers: {},
        bytes: new TextEncoder().encode(JSON.stringify({ sha })),
      },
      { status: 200, headers: {}, bytes },
    ]);
    const zip = await new GitHubVerificationSourceProvider({
      policy: acceptedPolicy,
      transport: zipTransport,
      addressResolver: new FixedAddressResolver(),
    }).resolve(input({
      type: "githubArchive",
      owner: "stellar",
      repository: "repo",
      revision: "main",
      format: "zip",
    }));
    if (zip.content !== "archive") throw new Error("expected archive");
    assertEquals(zip.name, `${sha}.zip`);
    assertEquals(zip.format, "zip");

    const releaseTransport = new QueueTransport([
      {
        status: 200,
        headers: {},
        bytes: new TextEncoder().encode(JSON.stringify({
          assets: [{
            name: "source.tar",
            url: "https://objects.example.com/source.tar",
          }],
        })),
      },
      { status: 200, headers: {}, bytes },
    ]);
    await new GitHubVerificationSourceProvider({
      policy: acceptedPolicy,
      token: "private",
      transport: releaseTransport,
      addressResolver: new FixedAddressResolver(),
    }).resolve(input({
      type: "githubReleaseAsset",
      owner: "stellar",
      repository: "repo",
      tag: "v1",
      asset: "source.tar",
    }));
    assertEquals(releaseTransport.calls[1].headers.authorization, undefined);
    assertEquals(releaseTransport.calls[1].headers.accept, undefined);
  });

  it("routes every supported source variant through one default provider", async () => {
    const sha = "d".repeat(40);
    const transport = new QueueTransport([
      { status: 200, headers: {}, bytes },
      {
        status: 200,
        headers: {},
        bytes: new TextEncoder().encode(JSON.stringify({ sha })),
      },
      { status: 200, headers: {}, bytes },
      {
        status: 200,
        headers: {},
        bytes: new TextEncoder().encode(JSON.stringify({
          assets: [{ name: "source.tar", url: "https://api.github.com/asset" }],
        })),
      },
      { status: 200, headers: {}, bytes },
    ]);
    const provider = new DefaultVerificationSourceProvider({
      sourcePolicy: acceptedPolicy,
      transport,
      addressResolver: new FixedAddressResolver(),
    });
    assertEquals(
      (await provider.resolve(input({
        type: "archive",
        name: "source.tar",
        bytes,
      }))).kind,
      "archive",
    );
    assertEquals(
      (await provider.resolve(input({
        type: "url",
        url: "https://example.com/source.tar",
      }))).kind,
      "url",
    );
    assertEquals(
      (await provider.resolve(input({
        type: "githubArchive",
        owner: "stellar",
        repository: "repo",
        revision: "main",
      }))).kind,
      "githubArchive",
    );
    assertEquals(
      (await provider.resolve(input({
        type: "githubReleaseAsset",
        owner: "stellar",
        repository: "repo",
        tag: "v1",
        asset: "source.tar",
      }))).kind,
      "githubReleaseAsset",
    );

    const root = await temporaryDirectory();
    const path = `${root}/source.tar`;
    await Deno.writeFile(path, bytes);
    assertEquals(
      (await provider.resolve(input({
        type: "path",
        path,
      }))).kind,
      "path",
    );
  });

  it("resolves literals and normalizes DNS failures", async () => {
    assertEquals(await new DenoSourceAddressResolver().resolve("127.0.0.1"), [
      "127.0.0.1",
    ]);
    assertEquals(await new DenoSourceAddressResolver().resolve("[::1]"), [
      "::1",
    ]);
    assert(
      (await new DenoSourceAddressResolver().resolve("localhost")).length > 0,
    );
    await assertRejects(
      () => new DenoSourceAddressResolver().resolve("does-not-exist.invalid"),
      SourceDnsResolutionFailedError,
    );
  });
});
