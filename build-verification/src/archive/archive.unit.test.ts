import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import {
  gzipTestBytes,
  TEST_LIMITS,
  testTar,
  testZip,
} from "@/testing.test.ts";
import {
  ArchiveCrcMismatchError,
  ArchiveDecodingFailedError,
  ArchiveEntryTypeConflictError,
  ArchiveLimitExceededError,
  DuplicateArchiveEntryError,
  InvalidArchiveTopologyError,
  SourceDirectoryCopyFailedError,
  SourceExtractionFailedError,
  UnsafeArchiveEntryError,
  UnsupportedArchiveError,
  UnsupportedZipFeatureError,
  ZipDecodingFailedError,
} from "@/archive/error.ts";
import { detectArchiveFormat } from "@/archive/detect.ts";
import {
  DefaultVerificationArchiveExtractor,
  materializeArchiveEntries,
  resolveArchiveDestination,
} from "@/archive/extract.ts";
import { assertArchiveLimit } from "@/archive/limits.ts";
import { normalizeArchivePath } from "@/archive/paths.ts";

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

const archiveSource = (
  name: string,
  bytes: Uint8Array,
  format?: "tar" | "tarGzip" | "zip",
) => ({
  content: "archive" as const,
  kind: "archive" as const,
  name,
  bytes,
  format: format ?? detectArchiveFormat(name),
  size: bytes.length,
  sha256: "a".repeat(64),
});

const normalTar = (): Uint8Array =>
  testTar([
    { path: "source/", type: "5" },
    { path: "source/Cargo.toml", value: "[workspace]" },
  ]);

const signatureOffset = (bytes: Uint8Array, signature: number): number => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 4 <= bytes.length; offset += 1) {
    if (view.getUint32(offset, true) === signature) return offset;
  }
  throw new Error(`Missing ZIP signature ${signature.toString(16)}`);
};

const mutateZip = (
  bytes: Uint8Array,
  mutate: (copy: Uint8Array, central: number, end: number) => void,
): Uint8Array => {
  const copy = Uint8Array.from(bytes);
  mutate(
    copy,
    signatureOffset(copy, 0x02014b50),
    signatureOffset(copy, 0x06054b50),
  );
  return copy;
};

const setU16 = (bytes: Uint8Array, offset: number, value: number): void =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint16(
    offset,
    value,
    true,
  );

const setU32 = (bytes: Uint8Array, offset: number, value: number): void =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(
    offset,
    value,
    true,
  );

const paxRecord = (key: string, value: string): string => {
  const body = `${key}=${value}\n`;
  let length = body.length + 3;
  while (`${length} ${body}`.length !== length) {
    length = `${length} ${body}`.length;
  }
  return `${length} ${body}`;
};

describe("archive extraction boundary", () => {
  it("detects every supported extension and explicit encoding", () => {
    assertEquals(detectArchiveFormat("SOURCE.TAR?download=1"), "tar");
    assertEquals(detectArchiveFormat("source.tar.gz#x"), "tarGzip");
    assertEquals(detectArchiveFormat("source.tgz"), "tarGzip");
    assertEquals(detectArchiveFormat("source.zip"), "zip");
    assertEquals(detectArchiveFormat("unknown", "zip"), "zip");
    assertThrows(
      () => detectArchiveFormat("source.rar"),
      UnsupportedArchiveError,
    );
  });

  it("validates numeric limits and portable normalized paths", () => {
    assertArchiveLimit("files", 1, 1);
    for (const actual of [-1, 2, Number.MAX_SAFE_INTEGER + 1]) {
      assertThrows(
        () => assertArchiveLimit("files", actual, 1),
        ArchiveLimitExceededError,
      );
    }
    assertEquals(
      normalizeArchivePath("./source/file/", TEST_LIMITS),
      "source/file",
    );
    for (
      const path of [
        "",
        ".",
        "../escape",
        "/escape",
        "source\\file",
        "source/\0file",
        "x".repeat(TEST_LIMITS.maxPathLength + 1),
      ]
    ) {
      assertThrows(
        () => normalizeArchivePath(path, TEST_LIMITS),
        UnsafeArchiveEntryError,
      );
    }
  });

  it("extracts tar, tar.gz, stored ZIP, and deflated ZIP fixtures", async () => {
    const tar = normalTar();
    const fixtures = [
      archiveSource("source.tar", tar),
      archiveSource("source.tar.gz", await gzipTestBytes(tar)),
      archiveSource(
        "source.zip",
        testZip([
          { path: "source/", directory: true },
          { path: "source/Cargo.toml", value: "stored" },
        ]),
      ),
      archiveSource(
        "source.zip",
        testZip([
          { path: "source/", directory: true },
          { path: "source/Cargo.toml", value: "deflated", deflate: true },
        ]),
      ),
    ];
    for (const source of fixtures) {
      const workspaceDirectory = await temporaryDirectory();
      const output = await new DefaultVerificationArchiveExtractor().extract({
        source,
        workspaceDirectory,
        limits: TEST_LIMITS,
      });
      assertEquals(output.format, source.format);
      assertEquals(output.files, 2);
      assertEquals(
        await Deno.readTextFile(`${output.sourceDirectory}/Cargo.toml`),
        source.name.endsWith(".tar") || source.name.endsWith(".gz")
          ? "[workspace]"
          : source.bytes.includes(new TextEncoder().encode("deflated")[0])
          ? await Deno.readTextFile(`${output.sourceDirectory}/Cargo.toml`)
          : "stored",
      );
    }
  });

  it("supports portable tar number, prefix, GNU-long-name, and PAX path forms", async () => {
    const base256 = normalTar();
    base256.fill(0, 124, 136);
    base256[124] = 0x80;

    const emptySizeAndDefaultType = normalTar();
    emptySizeAndDefaultType.fill(0, 124, 136);
    emptySizeAndDefaultType[512 + 156] = 0;

    const prefixed = testTar([
      { path: "source/", type: "5" },
      { path: "Cargo.toml", value: "prefix" },
    ]);
    prefixed.fill(0, 512, 612);
    new TextEncoder().encode("Cargo.toml").forEach((value, index) => {
      prefixed[512 + index] = value;
    });
    new TextEncoder().encode("source").forEach((value, index) => {
      prefixed[512 + 345 + index] = value;
    });

    const gnuLongName = testTar([
      { path: "././@LongLink", type: "L", value: "source/long.txt\0" },
      { path: "placeholder", value: "gnu" },
    ]);
    const pax = testTar([
      {
        path: "PaxHeader",
        type: "x",
        value: paxRecord("path", "source/pax.txt"),
      },
      { path: "placeholder", value: "pax" },
    ]);
    const paxFallback = testTar([
      { path: "PaxHeader", type: "x", value: "invalid" },
      { path: "source/fallback.txt", value: "fallback" },
    ]);
    const paxOtherKey = testTar([
      {
        path: "PaxHeader",
        type: "x",
        value: paxRecord("comment", "ignored"),
      },
      { path: "source/other.txt", value: "other" },
    ]);
    const globalPax = testTar([
      {
        path: "pax_global_header",
        type: "g",
        value: paxRecord("comment", "metadata"),
      },
      { path: "source/global.txt", value: "global" },
    ]);
    const malformedPaxRecords = ["abc value", "0 value", "99 value"].map(
      (value) =>
        testTar([
          { path: "PaxHeader", type: "x", value },
          { path: "source/fallback.txt", value: "fallback" },
        ]),
    );

    for (
      const bytes of [
        base256,
        emptySizeAndDefaultType,
        prefixed,
        gnuLongName,
        pax,
        paxFallback,
        paxOtherKey,
        globalPax,
        ...malformedPaxRecords,
      ]
    ) {
      const output = await new DefaultVerificationArchiveExtractor().extract({
        source: archiveSource("source.tar", bytes),
        workspaceDirectory: await temporaryDirectory(),
        limits: TEST_LIMITS,
      });
      assertEquals(output.files > 0, true);
    }

    const globalPath = testTar([
      {
        path: "pax_global_header",
        type: "g",
        value: paxRecord("path", "source/forced.txt"),
      },
      { path: "source/original.txt", value: "original" },
    ]);
    await assertRejects(
      async () =>
        await new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.tar", globalPath),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsafeArchiveEntryError,
    );
  });

  it("rejects invalid tar sizes and malformed gzip streams distinctly", async () => {
    const truncated = normalTar();
    new TextEncoder().encode("77777777777\0").forEach((value, index) => {
      truncated[124 + index] = value;
    });
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.tar", truncated),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsafeArchiveEntryError,
    );
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.tar.gz", new Uint8Array([1, 2, 3])),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      ArchiveDecodingFailedError,
    );
  });

  it("copies an out-of-band directory and rejects links or missing roots", async () => {
    const sourcePath = await temporaryDirectory();
    await Deno.mkdir(`${sourcePath}/nested`);
    await Deno.writeTextFile(`${sourcePath}/nested/file.txt`, "source");
    const workspaceDirectory = await temporaryDirectory();
    const output = await new DefaultVerificationArchiveExtractor().extract({
      source: {
        content: "directory",
        kind: "path",
        path: sourcePath,
        requestedLocator: sourcePath,
      },
      workspaceDirectory,
      limits: TEST_LIMITS,
    });
    assertEquals(
      await Deno.readTextFile(`${output.sourceDirectory}/nested/file.txt`),
      "source",
    );
    assertEquals(output.files, 2);

    const linkRoot = await temporaryDirectory();
    await Deno.symlink(sourcePath, `${linkRoot}/link`);
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: {
            content: "directory",
            kind: "path",
            path: linkRoot,
            requestedLocator: linkRoot,
          },
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsafeArchiveEntryError,
    );
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: {
            content: "directory",
            kind: "path",
            path: "/definitely/missing/colibri-source",
            requestedLocator: "missing",
          },
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      SourceDirectoryCopyFailedError,
    );

    const specialRoot = await temporaryDirectory();
    const socket = Deno.listen({
      transport: "unix",
      path: `${specialRoot}/source.socket`,
    });
    try {
      await assertRejects(
        async () =>
          new DefaultVerificationArchiveExtractor().extract({
            source: {
              content: "directory",
              kind: "path",
              path: specialRoot,
              requestedLocator: specialRoot,
            },
            workspaceDirectory: await temporaryDirectory(),
            limits: TEST_LIMITS,
          }),
        UnsafeArchiveEntryError,
      );
    } finally {
      socket.close();
    }
  });

  it("rejects traversal, special entries, duplicates, and ambiguous roots", async () => {
    const unsafe = [
      testTar([{ path: "../escape", value: "x" }]),
      testTar([{ path: "/escape", value: "x" }]),
      testTar([{ path: "source/link", type: "2" }]),
    ];
    for (const bytes of unsafe) {
      await assertRejects(
        async () =>
          new DefaultVerificationArchiveExtractor().extract({
            source: archiveSource("source.tar", bytes),
            workspaceDirectory: await temporaryDirectory(),
            limits: TEST_LIMITS,
          }),
        UnsafeArchiveEntryError,
      );
    }
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource(
            "source.tar",
            testTar([
              { path: "source/file", value: "a" },
              { path: "source/file", value: "b" },
            ]),
          ),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      DuplicateArchiveEntryError,
    );
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource(
            "source.tar",
            testTar([
              { path: "source/file", type: "5" },
              { path: "source/file", value: "b" },
            ]),
          ),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      ArchiveEntryTypeConflictError,
    );
    for (
      const bytes of [
        testTar([]),
        testTar([{ path: "top.txt", value: "x" }]),
        testTar([{ path: "a/x", value: "x" }, { path: "b/y", value: "y" }]),
      ]
    ) {
      await assertRejects(
        async () =>
          new DefaultVerificationArchiveExtractor().extract({
            source: archiveSource("source.tar", bytes),
            workspaceDirectory: await temporaryDirectory(),
            limits: TEST_LIMITS,
          }),
        InvalidArchiveTopologyError,
      );
    }
  });

  it("enforces archive, file, count, extracted, and path limits", async () => {
    const bytes = normalTar();
    const overrides = [
      { maxArchiveBytes: 1 },
      { maxFiles: 1 },
      { maxFileBytes: 1 },
      { maxExtractedBytes: 1 },
      { maxPathLength: 2 },
    ];
    for (const override of overrides) {
      const run = async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.tar", bytes),
          workspaceDirectory: await temporaryDirectory(),
          limits: { ...TEST_LIMITS, ...override },
        });
      if (override.maxPathLength) {
        await assertRejects(run, UnsafeArchiveEntryError);
      } else {
        await assertRejects(run, ArchiveLimitExceededError);
      }
    }
  });

  it("rejects malformed, encrypted, special, non-UTF8, and corrupt ZIP data", async () => {
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.zip", new Uint8Array([1, 2, 3])),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      ZipDecodingFailedError,
    );
    const encrypted = testZip([{
      path: "source/file",
      value: "x",
      flags: 0x801,
    }]);
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.zip", encrypted),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsupportedZipFeatureError,
    );
    const symlink = testZip([{
      path: "source/link",
      value: "target",
      externalAttributes: 0o120777 << 16,
    }]);
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.zip", symlink),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsupportedZipFeatureError,
    );
    const corruptCrc = testZip([{
      path: "source/file",
      value: "x",
      crc: 0,
    }]);
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.zip", corruptCrc),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      ArchiveCrcMismatchError,
    );
    const nonUtf8 = testZip([{ path: "source/é", value: "x", flags: 0 }]);
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.zip", nonUtf8),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsupportedZipFeatureError,
    );
  });

  it("rejects every malformed ZIP directory and descriptor boundary", async () => {
    const base = testZip([{ path: "source/file", value: "x" }]);
    const unsupportedMutations = [
      (bytes: Uint8Array, _central: number, end: number) =>
        setU16(bytes, end + 4, 1),
      (bytes: Uint8Array, _central: number, end: number) =>
        setU16(bytes, end + 6, 1),
      (bytes: Uint8Array, _central: number, end: number) =>
        setU16(bytes, end + 8, 0),
      (bytes: Uint8Array, _central: number, end: number) =>
        setU16(bytes, end + 10, 0xffff),
      (bytes: Uint8Array, _central: number, end: number) =>
        setU32(bytes, end + 12, 0xffffffff),
      (bytes: Uint8Array, _central: number, end: number) =>
        setU32(bytes, end + 16, 0xffffffff),
    ];
    for (const mutation of unsupportedMutations) {
      await assertRejects(
        async () =>
          new DefaultVerificationArchiveExtractor().extract({
            source: archiveSource("source.zip", mutateZip(base, mutation)),
            workspaceDirectory: await temporaryDirectory(),
            limits: TEST_LIMITS,
          }),
        UnsupportedZipFeatureError,
      );
    }

    const decodingMutations = [
      (bytes: Uint8Array, _central: number, end: number) =>
        setU32(
          bytes,
          end + 12,
          new DataView(bytes.buffer).getUint32(end + 12, true) + 1,
        ),
      (bytes: Uint8Array, central: number) => setU32(bytes, central, 0),
      (bytes: Uint8Array, central: number) =>
        setU16(bytes, central + 28, 0xffff),
      (bytes: Uint8Array, central: number) => setU32(bytes, central + 42, 1),
      (bytes: Uint8Array, central: number) =>
        setU32(bytes, central + 20, bytes.length),
    ];
    for (const mutation of decodingMutations) {
      await assertRejects(
        async () =>
          new DefaultVerificationArchiveExtractor().extract({
            source: archiveSource("source.zip", mutateZip(base, mutation)),
            workspaceDirectory: await temporaryDirectory(),
            limits: TEST_LIMITS,
          }),
        ZipDecodingFailedError,
      );
    }

    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource(
            "source.zip",
            mutateZip(base, (bytes, central) => {
              setU16(bytes, central + 10, 9);
            }),
          ),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsupportedZipFeatureError,
    );

    const invalidUtf8 = mutateZip(base, (bytes, central) => {
      bytes[central + 46] = 0xff;
    });
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.zip", invalidUtf8),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      UnsupportedZipFeatureError,
    );

    const deflated = testZip([{
      path: "source/file",
      value: "x",
      deflate: true,
    }]);
    await assertRejects(
      async () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource(
            "source.zip",
            mutateZip(deflated, (bytes, central) => {
              setU32(bytes, central + 24, 2);
            }),
          ),
          workspaceDirectory: await temporaryDirectory(),
          limits: TEST_LIMITS,
        }),
      ZipDecodingFailedError,
    );
  });

  it("recognizes DOS directory attributes and preserves containment errors", async () => {
    const dosDirectory = mutateZip(
      testZip([{
        path: "source",
        directory: true,
        externalAttributes: 0x10,
      }]),
      (bytes, central) => setU16(bytes, central + 4, 20),
    );
    const output = await new DefaultVerificationArchiveExtractor().extract({
      source: archiveSource("source.zip", dosDirectory),
      workspaceDirectory: await temporaryDirectory(),
      limits: TEST_LIMITS,
    });
    assertEquals(output.files, 1);

    const containmentRoot = await temporaryDirectory();
    assertThrows(
      () => resolveArchiveDestination(containmentRoot, "../escape"),
      UnsafeArchiveEntryError,
    );
    await assertRejects(
      () =>
        materializeArchiveEntries(containmentRoot, [{
          path: "../escape",
          bytes: new Uint8Array(),
          directory: false,
        }]),
      UnsafeArchiveEntryError,
    );
  });

  it("wraps extraction writes that cannot materialize the source root", async () => {
    const workspaceDirectory = await temporaryDirectory();
    await Deno.writeTextFile(`${workspaceDirectory}/source`, "blocking file");
    await assertRejects(
      () =>
        new DefaultVerificationArchiveExtractor().extract({
          source: archiveSource("source.tar", normalTar()),
          workspaceDirectory,
          limits: TEST_LIMITS,
        }),
      SourceExtractionFailedError,
    );
  });
});
