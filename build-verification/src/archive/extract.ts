import { dirname, join, relative, resolve } from "node:path";
import type { BuildVerificationLimits } from "../core/types/limits.ts";
import type {
  VerificationArchiveEntry,
  VerificationArchiveExtractor,
  VerificationArchiveExtractorInput,
  VerificationArchiveExtractorOutput,
} from "./types.ts";
import { detectArchiveFormat } from "./detect.ts";
import { assertArchiveLimit } from "./limits.ts";
import { normalizeArchivePath } from "./paths.ts";
import {
  ArchiveCrcMismatchError,
  ArchiveDecodingFailedError,
  ArchiveEntryTypeConflictError,
  DuplicateArchiveEntryError,
  InvalidArchiveTopologyError,
  SourceDirectoryCopyFailedError,
  SourceExtractionFailedError,
  UnsafeArchiveEntryError,
  UnsupportedZipFeatureError,
  ZipDecodingFailedError,
} from "./error.ts";

const decodeText = (bytes: Uint8Array): string =>
  new TextDecoder().decode(bytes).replace(/\0.*$/s, "").trim();

const tarNumber = (bytes: Uint8Array): number => {
  if ((bytes[0] & 0x80) !== 0) {
    let value = BigInt(bytes[0] & 0x7f);
    for (const byte of bytes.subarray(1)) value = (value << 8n) | BigInt(byte);
    return Number(value);
  }
  const value = decodeText(bytes);
  return value ? Number.parseInt(value, 8) : 0;
};

const parsePaxPath = (bytes: Uint8Array): string | undefined => {
  let offset = 0;
  let path: string | undefined;
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset);
    if (space < 0) break;
    const length = Number.parseInt(
      decodeText(bytes.subarray(offset, space)),
      10,
    );
    if (
      !Number.isSafeInteger(length) || length <= 0 ||
      offset + length > bytes.length
    ) {
      break;
    }
    const record = new TextDecoder().decode(
      bytes.subarray(space + 1, offset + length - 1),
    );
    const equals = record.indexOf("=");
    if (equals > 0 && record.slice(0, equals) === "path") {
      path = record.slice(equals + 1);
    }
    offset += length;
  }
  return path;
};

const parseTar = (bytes: Uint8Array): VerificationArchiveEntry[] => {
  const entries: VerificationArchiveEntry[] = [];
  let offset = 0;
  let pendingPath: string | undefined;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = tarNumber(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 0x30);
    const prefix = decodeText(header.subarray(345, 500));
    const name = decodeText(header.subarray(0, 100));
    const headerPath = prefix ? `${prefix}/${name}` : name;
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (!Number.isSafeInteger(size) || size < 0 || dataEnd > bytes.length) {
      throw new UnsafeArchiveEntryError(
        headerPath,
        "A tar entry declares an invalid or truncated size.",
      );
    }
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "L") {
      pendingPath = decodeText(data);
    } else if (type === "x") {
      pendingPath = parsePaxPath(data) ?? pendingPath;
    } else if (type === "g") {
      if (parsePaxPath(data)) {
        throw new UnsafeArchiveEntryError(
          headerPath,
          "A global PAX header cannot redefine paths for subsequent entries.",
        );
      }
    } else if (type === "0" || type === "\0" || type === "5") {
      entries.push({
        path: pendingPath ?? headerPath,
        bytes: Uint8Array.from(data),
        directory: type === "5",
      });
      pendingPath = undefined;
    } else {
      throw new UnsafeArchiveEntryError(
        pendingPath ?? headerPath,
        `Tar entry type "${type}" is not a regular file or directory.`,
      );
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
};

const decompressBounded = async (
  bytes: Uint8Array,
  format: CompressionFormat | "deflate-raw",
  maximum: number,
): Promise<Uint8Array> => {
  const stream = new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(
    new DecompressionStream(format as CompressionFormat),
  );
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    assertArchiveLimit("decompressed archive byte", total, maximum);
    chunks.push(chunk);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const u16 = (view: DataView, offset: number): number =>
  view.getUint16(offset, true);
const u32 = (view: DataView, offset: number): number =>
  view.getUint32(offset, true);

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const decodeZipName = (bytes: Uint8Array, utf8: boolean): string => {
  if (!utf8 && bytes.some((byte) => byte > 0x7f)) {
    throw new UnsupportedZipFeatureError(
      "<encoded-name>",
      "non-UTF-8 filename",
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new UnsupportedZipFeatureError(
      String(cause),
      "invalid UTF-8 filename",
    );
  }
};

const findEndOfCentralDirectory = (bytes: Uint8Array): number => {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (
      bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06
    ) return offset;
  }
  throw new RangeError("ZIP end-of-central-directory record was not found");
};

const parseZip = async (
  bytes: Uint8Array,
  limits: BuildVerificationLimits,
): Promise<VerificationArchiveEntry[]> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(bytes);
  const disk = u16(view, end + 4);
  const centralDisk = u16(view, end + 6);
  const entriesOnDisk = u16(view, end + 8);
  const entryCount = u16(view, end + 10);
  const centralSize = u32(view, end + 12);
  const centralOffset = u32(view, end + 16);
  if (
    disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount ||
    entryCount === 0xffff || centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    throw new UnsupportedZipFeatureError("<archive>", "multi-disk or ZIP64");
  }
  if (centralOffset + centralSize > end) {
    throw new RangeError(
      "ZIP central directory is outside the archive boundary",
    );
  }
  assertArchiveLimit("file count", entryCount, limits.maxFiles);

  const entries: VerificationArchiveEntry[] = [];
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(view, offset) !== 0x02014b50) {
      throw new RangeError("ZIP central-directory entry signature is invalid");
    }
    const madeBy = u16(view, offset + 4);
    const flags = u16(view, offset + 8);
    const method = u16(view, offset + 10);
    const expectedCrc = u32(view, offset + 16);
    const compressedSize = u32(view, offset + 20);
    const size = u32(view, offset + 24);
    const nameLength = u16(view, offset + 28);
    const extraLength = u16(view, offset + 30);
    const commentLength = u16(view, offset + 32);
    const externalAttributes = u32(view, offset + 38);
    const localOffset = u32(view, offset + 42);
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > centralOffset + centralSize) {
      throw new RangeError("ZIP central-directory entry is truncated");
    }
    const name = decodeZipName(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
      (flags & 0x800) !== 0,
    );
    if ((flags & 1) !== 0) {
      throw new UnsupportedZipFeatureError(name, "encryption");
    }
    if (method !== 0 && method !== 8) {
      throw new UnsupportedZipFeatureError(
        name,
        `compression method ${method}`,
      );
    }
    const unixMode = madeBy >>> 8 === 3
      ? (externalAttributes >>> 16) & 0xffff
      : 0;
    const unixType = unixMode & 0o170000;
    if (unixType !== 0 && unixType !== 0o100000 && unixType !== 0o040000) {
      throw new UnsupportedZipFeatureError(name, `Unix file type ${unixType}`);
    }
    const directory = name.endsWith("/") || unixType === 0o040000 ||
      ((externalAttributes & 0x10) !== 0 && unixType === 0);
    assertArchiveLimit("individual file byte", size, limits.maxFileBytes);
    if (u32(view, localOffset) !== 0x04034b50) {
      throw new RangeError("ZIP local-file entry signature is invalid");
    }
    const localNameLength = u16(view, localOffset + 26);
    const localExtraLength = u16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) {
      throw new RangeError("ZIP file data is truncated");
    }
    const compressed = bytes.subarray(dataStart, dataEnd);
    const content = directory
      ? new Uint8Array()
      : method === 0
      ? Uint8Array.from(compressed)
      : await decompressBounded(compressed, "deflate-raw", size);
    if (content.length !== size) {
      throw new RangeError("ZIP decompressed size differs from its descriptor");
    }
    if (!directory) {
      const actualCrc = crc32(content);
      if (actualCrc !== expectedCrc) {
        throw new ArchiveCrcMismatchError(name, expectedCrc, actualCrc);
      }
    }
    entries.push({ path: name, bytes: content, directory });
    offset = recordEnd;
  }
  return entries;
};

const decodeEntries = async (
  name: string,
  bytes: Uint8Array,
  format: "tar" | "tarGzip" | "zip",
  limits: BuildVerificationLimits,
): Promise<VerificationArchiveEntry[]> => {
  try {
    if (format === "tar") return parseTar(bytes);
    if (format === "tarGzip") {
      const maximum = limits.maxExtractedBytes + limits.maxFiles * 512 + 1024;
      return parseTar(await decompressBounded(bytes, "gzip", maximum));
    }
    return await parseZip(bytes, limits);
  } catch (cause) {
    if (
      cause instanceof UnsafeArchiveEntryError ||
      cause instanceof UnsupportedZipFeatureError ||
      cause instanceof ArchiveCrcMismatchError
    ) throw cause;
    if (format === "zip") throw new ZipDecodingFailedError(name, cause);
    throw new ArchiveDecodingFailedError(name, cause);
  }
};

const validateEntries = (
  entries: readonly VerificationArchiveEntry[],
  limits: BuildVerificationLimits,
): { entries: VerificationArchiveEntry[]; root: string; bytes: number } => {
  assertArchiveLimit("file count", entries.length, limits.maxFiles);
  const normalized: VerificationArchiveEntry[] = [];
  const seen = new Map<string, boolean>();
  let extractedBytes = 0;
  for (const entry of entries) {
    const path = normalizeArchivePath(entry.path, limits);
    const previous = seen.get(path);
    if (previous !== undefined) {
      if (previous !== entry.directory) {
        throw new ArchiveEntryTypeConflictError(path);
      }
      throw new DuplicateArchiveEntryError(path);
    }
    seen.set(path, entry.directory);
    assertArchiveLimit(
      "individual file byte",
      entry.bytes.length,
      limits.maxFileBytes,
    );
    if (!entry.directory) extractedBytes += entry.bytes.length;
    assertArchiveLimit(
      "extracted byte",
      extractedBytes,
      limits.maxExtractedBytes,
    );
    normalized.push({ ...entry, path });
  }
  const roots = [...new Set(normalized.map(({ path }) => path.split("/")[0]))];
  const topLevelFile = normalized.some(({ path, directory }) =>
    !directory && !path.includes("/")
  );
  if (normalized.length === 0 || roots.length !== 1 || topLevelFile) {
    throw new InvalidArchiveTopologyError(roots);
  }
  return { entries: normalized, root: roots[0], bytes: extractedBytes };
};

const copyDirectory = async (
  from: string,
  to: string,
  limits: BuildVerificationLimits,
): Promise<{ files: number; bytes: number }> => {
  let files = 0;
  let bytes = 0;
  const walk = async (current: string): Promise<void> => {
    for await (const entry of Deno.readDir(current)) {
      const source = join(current, entry.name);
      const relativePath = relative(from, source).replaceAll("\\", "/");
      normalizeArchivePath(relativePath, limits);
      if (entry.isSymlink) {
        throw new UnsafeArchiveEntryError(
          relativePath,
          "Source directories cannot contain symbolic links.",
        );
      }
      const destination = resolveArchiveDestination(
        to,
        relativePath,
        "Source path escaped its workspace.",
      );
      files += 1;
      assertArchiveLimit("file count", files, limits.maxFiles);
      if (entry.isDirectory) {
        await Deno.mkdir(destination, { recursive: true });
        await walk(source);
      } else if (entry.isFile) {
        const stat = await Deno.stat(source);
        assertArchiveLimit(
          "individual file byte",
          stat.size,
          limits.maxFileBytes,
        );
        bytes += stat.size;
        assertArchiveLimit("extracted byte", bytes, limits.maxExtractedBytes);
        await Deno.mkdir(dirname(destination), { recursive: true });
        await Deno.copyFile(source, destination);
      } else {
        throw new UnsafeArchiveEntryError(
          relativePath,
          "Only regular files and directories are supported.",
        );
      }
    }
  };
  try {
    await Deno.mkdir(to, { recursive: true });
    await walk(from);
    return { files, bytes };
  } catch (cause) {
    if (cause instanceof UnsafeArchiveEntryError) throw cause;
    throw new SourceDirectoryCopyFailedError(from, cause);
  }
};

/** Resolves a candidate path and rejects containment escapes. */
export const resolveArchiveDestination = (
  root: string,
  relativePath: string,
  reason = "Archive entry escaped extraction root.",
): string => {
  const resolvedRoot = resolve(root);
  const destination = resolve(join(resolvedRoot, relativePath));
  if (!destination.startsWith(`${resolvedRoot}/`)) {
    throw new UnsafeArchiveEntryError(relativePath, reason);
  }
  return destination;
};

/** Materializes validated entries while preserving typed containment failures. */
export const materializeArchiveEntries = async (
  extractionRoot: string,
  entries: readonly VerificationArchiveEntry[],
): Promise<void> => {
  try {
    await Deno.mkdir(extractionRoot, { recursive: true });
    for (const entry of entries) {
      const destination = resolveArchiveDestination(extractionRoot, entry.path);
      if (entry.directory) {
        await Deno.mkdir(destination, { recursive: true });
      } else {
        await Deno.mkdir(dirname(destination), { recursive: true });
        await Deno.writeFile(destination, entry.bytes, { mode: 0o644 });
      }
    }
  } catch (cause) {
    if (cause instanceof UnsafeArchiveEntryError) throw cause;
    throw new SourceExtractionFailedError(cause);
  }
};

/** Default safe tar, tar.gz, ZIP, and local-directory extractor. */
export class DefaultVerificationArchiveExtractor
  implements VerificationArchiveExtractor {
  /** Materializes one resolved source into its disposable workspace. */
  async extract(
    input: VerificationArchiveExtractorInput,
  ): Promise<VerificationArchiveExtractorOutput> {
    const extractionRoot = resolve(join(input.workspaceDirectory, "source"));
    if (input.source.content === "directory") {
      const copied = await copyDirectory(
        input.source.path,
        extractionRoot,
        input.limits,
      );
      return {
        sourceDirectory: extractionRoot,
        files: copied.files,
        extractedBytes: copied.bytes,
      };
    }

    assertArchiveLimit(
      "archive byte",
      input.source.bytes.length,
      input.limits.maxArchiveBytes,
    );
    const format = detectArchiveFormat(input.source.name, input.source.format);
    const entries = await decodeEntries(
      input.source.name,
      input.source.bytes,
      format,
      input.limits,
    );
    const validated = validateEntries(entries, input.limits);
    await materializeArchiveEntries(extractionRoot, validated.entries);
    return {
      sourceDirectory: join(extractionRoot, validated.root),
      format,
      files: validated.entries.length,
      extractedBytes: validated.bytes,
    };
  }
}
