import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { dirname } from "node:path";
import * as E from "@/error.ts";
import { sha256Hex } from "@/hash.ts";
import { prepareSource } from "@/source.ts";
import { DEFAULT_BUILD_VERIFICATION_LIMITS } from "@/types.ts";

const encoder = new TextEncoder();
const temporaryDirectories: string[] = [];
const tempDir = async (): Promise<string> => {
  const path = await Deno.makeTempDir();
  temporaryDirectories.push(path);
  return path;
};

afterEach(async () => {
  for (const path of temporaryDirectories.splice(0)) {
    try {
      await Deno.remove(path, { recursive: true });
    } catch {
      // A prepared source cleanup may already have removed the directory.
    }
  }
});

const writeAscii = (
  target: Uint8Array,
  offset: number,
  length: number,
  value: string,
): void => {
  target.set(encoder.encode(value).subarray(0, length), offset);
};

const tar = (
  entries: readonly { path: string; value?: string; type?: string }[],
): Uint8Array => {
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    const bytes = encoder.encode(entry.value ?? "");
    const header = new Uint8Array(512);
    writeAscii(header, 0, 100, entry.path);
    writeAscii(header, 100, 8, "0000644\0");
    writeAscii(
      header,
      124,
      12,
      bytes.length.toString(8).padStart(11, "0") + "\0",
    );
    header[156] = (entry.type ?? "0").charCodeAt(0);
    chunks.push(
      header,
      bytes,
      new Uint8Array((512 - bytes.length % 512) % 512),
    );
  }
  chunks.push(new Uint8Array(1024));
  const output = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const normalTar = (): Uint8Array =>
  tar([
    { path: "source/", type: "5" },
    { path: "source/Cargo.toml", value: "[workspace]" },
  ]);

const gzip = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(
    await new Response(
      new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(
        new CompressionStream("gzip"),
      ),
    ).arrayBuffer(),
  );

const tarWithMutatedHeader = (
  mutate: (header: Uint8Array) => void,
  value = "x",
): Uint8Array => {
  const bytes = tar([{ path: "source/file", value }]);
  mutate(bytes.subarray(0, 512));
  return bytes;
};

const paxRecord = (path: string): string => {
  const body = `path=${path}\n`;
  let length = body.length + 2;
  while (`${length} ${body}`.length !== length) {
    length = `${length} ${body}`.length;
  }
  return `${length} ${body}`;
};

const args = (overrides: Record<string, unknown> = {}) => ({
  strict: true,
  fetcher: fetch,
  limits: DEFAULT_BUILD_VERIFICATION_LIMITS,
  ...overrides,
});

describe("source preparation", () => {
  it("extracts authenticated tar and tar.gz archive bytes", async () => {
    for (
      const [name, bytes] of [["source.tar", normalTar()], [
        "source.tgz",
        await gzip(normalTar()),
      ]] as const
    ) {
      const prepared = await prepareSource({
        ...args(),
        source: { type: "archive", name, bytes },
        expectedSha256: await sha256Hex(bytes),
      });
      assertEquals(
        await Deno.readTextFile(`${prepared.directory}/Cargo.toml`),
        "[workspace]",
      );
      assertEquals(prepared.kind, "archive");
      assertEquals(prepared.sha256, await sha256Hex(bytes));
      await prepared.cleanup();
    }
  });

  it("accepts a directory only for explicitly out-of-band verification", async () => {
    const directory = await tempDir();
    const prepared = await prepareSource({
      ...args({ strict: false }),
      source: { type: "path", path: directory },
    });
    assertEquals(prepared.directory, directory);
    assertEquals(prepared.locator, directory);
    assertEquals(prepared.sha256, undefined);
    await prepared.cleanup();
    await assertRejects(
      () =>
        prepareSource({ ...args(), source: { type: "path", path: directory } }),
      E.UnsupportedSourceError,
    );
  });

  it("reads a local archive file", async () => {
    const directory = await tempDir();
    const path = `${directory}/source.tar`;
    await Deno.writeFile(path, normalTar());
    const prepared = await prepareSource({
      ...args(),
      source: { type: "path", path },
    });
    assertEquals(prepared.kind, "path");
    await prepared.cleanup();
  });

  it("downloads explicit and metadata URLs with bounded streaming", async () => {
    const bytes = normalTar();
    const fetched: string[] = [];
    const fetcher = (input: string | URL | Request): Promise<Response> => {
      fetched.push(String(input));
      return Promise.resolve(
        new Response(Uint8Array.from(bytes), { status: 200 }),
      );
    };
    const direct = await prepareSource({
      ...args({ fetcher }),
      source: { type: "url", url: "https://example.com/source.tar" },
    });
    assertEquals(direct.kind, "url");
    await direct.cleanup();
    const metadata = await prepareSource({
      ...args({ fetcher }),
      metadataUrl: "https://example.com/metadata.tar",
    });
    assertEquals(metadata.kind, "metadataUrl");
    await metadata.cleanup();
    assertEquals(fetched, [
      "https://example.com/source.tar",
      "https://example.com/metadata.tar",
    ]);
  });

  it("resolves a GitHub archive convenience source", async () => {
    const bytes = await gzip(normalTar());
    let requested = "";
    const prepared = await prepareSource({
      ...args({
        fetcher: (input: string | URL | Request) => {
          requested = String(input);
          return Promise.resolve(new Response(Uint8Array.from(bytes)));
        },
      }),
      source: {
        type: "github",
        owner: "stellar",
        repository: "example",
        ref: "main",
      },
    });
    assertEquals(
      requested,
      "https://github.com/stellar/example/archive/main.tar.gz",
    );
    assertEquals(prepared.kind, "github");
    await prepared.cleanup();
  });

  it("rejects missing, unreadable, malformed, or unsupported sources", async () => {
    await assertRejects(
      () => prepareSource(args()),
      E.MissingVerificationSourceError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "path", path: "/does/not/exist" },
        }),
      E.UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        prepareSource({ ...args(), source: { type: "url", url: "not-a-url" } }),
      E.UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "url", url: "ipfs://cid/source.tar" },
        }),
      E.UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: {
            type: "github",
            owner: "bad/name",
            repository: "repo",
            ref: "main",
          },
        }),
      E.UnsupportedSourceError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "archive", name: "source.zip", bytes: normalTar() },
        }),
      E.UnsupportedArchiveError,
    );
  });

  it("surfaces download and archive-hash failures", async () => {
    await assertRejects(() =>
      prepareSource({
        ...args({ fetcher: () => Promise.reject(new Error("offline")) }),
        source: { type: "url", url: "https://example.com/source.tar" },
      }), E.SourceDownloadFailedError);
    await assertRejects(() =>
      prepareSource({
        ...args({
          fetcher: () => Promise.resolve(new Response("no", { status: 404 })),
        }),
        source: { type: "url", url: "https://example.com/source.tar" },
      }), E.SourceDownloadFailedError);
    await assertRejects(() =>
      prepareSource({
        ...args({
          fetcher: () =>
            Promise.resolve(
              new Response(
                new ReadableStream({
                  cancel: () => Promise.reject(new Error("cancel failed")),
                }),
                { status: 500 },
              ),
            ),
        }),
        source: { type: "url", url: "https://example.com/source.tar" },
      }), E.SourceDownloadFailedError);
    await assertRejects(() =>
      prepareSource({
        ...args(),
        source: { type: "archive", name: "source.tar", bytes: normalTar() },
        expectedSha256: "0".repeat(64),
      }), E.SourceHashMismatchError);
  });

  it("enforces archive byte, file, and extraction limits", async () => {
    const bytes = normalTar();
    const compressed = await gzip(bytes);
    await assertRejects(
      () =>
        prepareSource({
          ...args({
            limits: {
              ...DEFAULT_BUILD_VERIFICATION_LIMITS,
              maxArchiveBytes: 1,
            },
          }),
          source: { type: "archive", name: "x.tar", bytes },
        }),
      E.ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args({
            limits: { ...DEFAULT_BUILD_VERIFICATION_LIMITS, maxFiles: 1 },
          }),
          source: { type: "archive", name: "x.tar", bytes },
        }),
      E.ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args({
            limits: { ...DEFAULT_BUILD_VERIFICATION_LIMITS, maxFileBytes: 1 },
          }),
          source: { type: "archive", name: "x.tar", bytes },
        }),
      E.ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args({
            limits: {
              ...DEFAULT_BUILD_VERIFICATION_LIMITS,
              maxExtractedBytes: 1,
            },
          }),
          source: { type: "archive", name: "x.tar", bytes },
        }),
      E.ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args({
            limits: {
              ...DEFAULT_BUILD_VERIFICATION_LIMITS,
              maxExtractedBytes: 1,
              maxFiles: 1,
            },
          }),
          source: { type: "archive", name: "x.tgz", bytes: compressed },
        }),
      E.ArchiveLimitExceededError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args({
            limits: { ...DEFAULT_BUILD_VERIFICATION_LIMITS, maxPathLength: 2 },
          }),
          source: { type: "archive", name: "x.tar", bytes },
        }),
      E.UnsafeArchiveEntryError,
    );
  });

  it("rejects unsafe archive paths, special entries, and invalid topologies", async () => {
    for (
      const bytes of [
        tar([{ path: "../escape", value: "x" }]),
        tar([{ path: "/escape", value: "x" }]),
        tar([{ path: "a\\b", value: "x" }]),
        tar([{ path: "source/link", type: "2" }]),
      ]
    ) {
      await assertRejects(
        () =>
          prepareSource({
            ...args(),
            source: { type: "archive", name: "x.tar", bytes },
          }),
        E.UnsafeArchiveEntryError,
      );
    }
    for (
      const bytes of [
        tar([]),
        tar([{ path: "top.txt", value: "x" }]),
        tar([{ path: "a/x", value: "x" }, { path: "b/y", value: "y" }]),
      ]
    ) {
      await assertRejects(
        () =>
          prepareSource({
            ...args(),
            source: { type: "archive", name: "x.tar", bytes },
          }),
        E.InvalidArchiveTopologyError,
      );
    }
  });

  it("rejects declared and streamed downloads beyond the archive limit", async () => {
    const limits = { ...DEFAULT_BUILD_VERIFICATION_LIMITS, maxArchiveBytes: 1 };
    await assertRejects(() =>
      prepareSource({
        ...args({
          limits,
          fetcher: () =>
            Promise.resolve(
              new Response("x", { headers: { "content-length": "2" } }),
            ),
        }),
        source: { type: "url", url: "https://example.com/x.tar" },
      }), E.ArchiveLimitExceededError);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.close();
      },
    });
    await assertRejects(() =>
      prepareSource({
        ...args({
          limits,
          fetcher: () => Promise.resolve(new Response(stream)),
        }),
        source: { type: "url", url: "https://example.com/x.tar" },
      }), E.ArchiveLimitExceededError);
    assert(true);
  });

  it("supports common tar path and numeric encodings", async () => {
    const longName = tar([
      { path: "././@LongLink", value: "source/long-name.txt\0", type: "L" },
      { path: "placeholder", value: "long" },
    ]);
    const pax = tar([
      { path: "pax", value: paxRecord("source/pax-name.txt"), type: "x" },
      { path: "placeholder", value: "pax" },
    ]);
    const prefixed = tarWithMutatedHeader((header) => {
      header.fill(0, 0, 100);
      header.fill(0, 345, 500);
      writeAscii(header, 0, 100, "file.txt");
      writeAscii(header, 345, 155, "source");
    });
    const binarySize = tarWithMutatedHeader((header) => {
      header.fill(0, 124, 136);
      header[124] = 0x80;
      header[135] = 1;
      header[156] = 0;
    });
    const emptySize = tarWithMutatedHeader((header) => {
      header.fill(0, 124, 136);
    }, "");
    const invalidPax = tar([
      { path: "././@LongLink", value: "source/fallback.txt\0", type: "L" },
      { path: "pax", value: "invalid", type: "x" },
      { path: "placeholder", value: "fallback" },
    ]);
    const malformedPaxLength = tar([
      { path: "pax", value: "x path=source/ignored\n", type: "x" },
      { path: "source/plain.txt", value: "plain" },
    ]);
    for (
      const [bytes, file, value] of [
        [longName, "long-name.txt", "long"],
        [pax, "pax-name.txt", "pax"],
        [prefixed, "file.txt", "x"],
        [binarySize, "file", "x"],
        [emptySize, "file", ""],
        [invalidPax, "fallback.txt", "fallback"],
        [malformedPaxLength, "plain.txt", "plain"],
      ] as const
    ) {
      const prepared = await prepareSource({
        ...args(),
        source: { type: "archive", name: "x.tar", bytes },
      });
      assertEquals(
        await Deno.readTextFile(`${prepared.directory}/${file}`),
        value,
      );
      await prepared.cleanup();
    }
  });

  it("rejects truncated tar values and corrupt compressed archives", async () => {
    const truncated = tarWithMutatedHeader((header) => {
      writeAscii(header, 124, 12, "77777777777\0");
    });
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "archive", name: "x.tar", bytes: truncated },
        }),
      E.UnsafeArchiveEntryError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: {
            type: "archive",
            name: "x.tgz",
            bytes: new Uint8Array([1, 2]),
          },
        }),
      E.ArchiveDecodingFailedError,
    );
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: {
            type: "archive",
            name: "x.tar",
            bytes: tar([{ path: "./", type: "5" }]),
          },
        }),
      E.UnsafeArchiveEntryError,
    );
  });

  it("cleans a temporary extraction directory after a filesystem collision", async () => {
    const collision = tar([
      { path: "source/path", value: "file" },
      { path: "source/path/child", value: "child" },
    ]);
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "archive", name: "x.tar", bytes: collision },
        }),
      E.SourceExtractionFailedError,
    );

    const directory = await tempDir();
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "archive", name: "x.tar", bytes: collision },
          dependencies: {
            makeTempDir: () => Promise.resolve(directory),
            remove: () => Promise.reject(new Error("cleanup failed")),
          },
        }),
      E.SourceExtractionCleanupFailedError,
    );
  });

  it("uses unique errors for source filesystem boundaries", async () => {
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "archive", name: "x.tar", bytes: normalTar() },
          dependencies: {
            makeTempDir: () =>
              Promise.reject(new Error("temporary directory failed")),
          },
        }),
      E.SourceExtractionInitializationFailedError,
    );

    const directory = await tempDir();
    const path = `${directory}/source.tar`;
    await Deno.writeFile(path, normalTar());
    await assertRejects(
      () =>
        prepareSource({
          ...args(),
          source: { type: "path", path },
          dependencies: {
            readFile: () => Promise.reject(new Error("read failed")),
          },
        }),
      E.LocalSourceArchiveReadFailedError,
    );

    const prepared = await prepareSource({
      ...args(),
      source: { type: "archive", name: "x.tar", bytes: normalTar() },
      dependencies: {
        remove: () => Promise.reject(new Error("cleanup failed")),
      },
    });
    await assertRejects(
      () => prepared.cleanup(),
      E.SourceCleanupFailedError,
    );
    await Deno.remove(dirname(prepared.directory), { recursive: true });
  });

  it("handles empty and failing response bodies as typed source failures", async () => {
    await assertRejects(() =>
      prepareSource({
        ...args({ fetcher: () => Promise.resolve(new Response(null)) }),
        source: { type: "url", url: "https://example.com/x.tar" },
      }), E.InvalidArchiveTopologyError);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("stream failed"));
      },
    });
    await assertRejects(() =>
      prepareSource({
        ...args({ fetcher: () => Promise.resolve(new Response(stream)) }),
        source: { type: "url", url: "https://example.com/x.tar" },
      }), E.SourceDownloadFailedError);
  });
});
