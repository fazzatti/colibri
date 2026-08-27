import { dirname, join, posix, resolve } from "node:path";
import {
  ArchiveDecodingFailedError,
  ArchiveLimitExceededError,
  InvalidArchiveTopologyError,
  LocalSourceArchiveReadFailedError,
  MissingVerificationSourceError,
  SourceCleanupFailedError,
  SourceDownloadFailedError,
  SourceExtractionCleanupFailedError,
  SourceExtractionFailedError,
  SourceExtractionInitializationFailedError,
  SourceHashMismatchError,
  UnsafeArchiveEntryError,
  UnsupportedArchiveError,
  UnsupportedSourceError,
} from "@/error.ts";
import { sha256Hex } from "@/hash.ts";
import type { BuildVerificationLimits, VerificationSource } from "@/types.ts";

type ArchiveEntry = {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly directory: boolean;
};

/** Prepared source tree and the evidence needed to describe it. */
export type PreparedSource = {
  readonly directory: string;
  readonly kind: VerificationSource["type"] | "metadataUrl";
  readonly locator?: string;
  readonly sha256?: string;
  cleanup(): Promise<void>;
};

/** @internal Filesystem seams used to verify extraction failure handling. */
export type SourcePreparationDependencies = {
  readonly makeTempDir?: typeof Deno.makeTempDir;
  readonly remove?: typeof Deno.remove;
  readonly readFile?: typeof Deno.readFile;
};

const text = (bytes: Uint8Array): string =>
  new TextDecoder().decode(bytes).replace(/\0.*$/s, "").trim();

const tarNumber = (bytes: Uint8Array): number => {
  if ((bytes[0] & 0x80) !== 0) {
    let value = BigInt(bytes[0] & 0x7f);
    for (const byte of bytes.subarray(1)) value = (value << 8n) | BigInt(byte);
    return Number(value);
  }
  const value = text(bytes);
  return value ? Number.parseInt(value, 8) : 0;
};

const parsePaxPath = (bytes: Uint8Array): string | undefined => {
  let offset = 0;
  let path: string | undefined;
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset);
    if (space < 0) break;
    const length = Number.parseInt(text(bytes.subarray(offset, space)), 10);
    if (
      !Number.isFinite(length) || length <= 0 || offset + length > bytes.length
    ) break;
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

const parseTar = (bytes: Uint8Array): ArchiveEntry[] => {
  const entries: ArchiveEntry[] = [];
  let offset = 0;
  let pendingPath: string | undefined;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = tarNumber(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 0x30);
    const prefix = text(header.subarray(345, 500));
    const name = text(header.subarray(0, 100));
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
      pendingPath = text(data);
    } else if (type === "x") {
      pendingPath = parsePaxPath(data) ?? pendingPath;
    } else if (type === "0" || type === "\0" || type === "5") {
      entries.push({
        path: pendingPath ?? headerPath,
        bytes: data,
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

const gunzipBounded = async (
  bytes: Uint8Array,
  maximum: number,
): Promise<Uint8Array> => {
  const stream = new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(
    new DecompressionStream("gzip"),
  );
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > maximum) {
      throw new ArchiveLimitExceededError(
        "decompressed archive byte",
        total,
        maximum,
      );
    }
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

const archiveEntries = async (
  name: string,
  bytes: Uint8Array,
  limits: BuildVerificationLimits,
): Promise<ArchiveEntry[]> => {
  const lower = name.toLowerCase().split(/[?#]/, 1)[0];
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    const maximum = limits.maxExtractedBytes + limits.maxFiles * 512 + 1024;
    return parseTar(await gunzipBounded(bytes, maximum));
  }
  if (lower.endsWith(".tar")) return parseTar(bytes);
  throw new UnsupportedArchiveError(name);
};

const validateEntryPath = (
  path: string,
  limits: BuildVerificationLimits,
): string => {
  if (
    !path || path.includes("\0") || path.includes("\\") ||
    path.length > limits.maxPathLength
  ) {
    throw new UnsafeArchiveEntryError(
      path,
      "Archive entry paths must be non-empty, portable, and within the configured length limit.",
    );
  }
  if (posix.isAbsolute(path) || path.split("/").includes("..")) {
    throw new UnsafeArchiveEntryError(
      path,
      "Archive entries cannot be absolute or traverse parent directories.",
    );
  }
  const normalized = posix.normalize(path).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized.startsWith("../")) {
    throw new UnsafeArchiveEntryError(
      path,
      "Archive entry normalization escaped the extraction root.",
    );
  }
  return normalized;
};

const extractArchive = async (
  name: string,
  bytes: Uint8Array,
  limits: BuildVerificationLimits,
  dependencies: SourcePreparationDependencies = {},
): Promise<{ root: string; temporaryDirectory: string }> => {
  if (bytes.length > limits.maxArchiveBytes) {
    throw new ArchiveLimitExceededError(
      "archive byte",
      bytes.length,
      limits.maxArchiveBytes,
    );
  }
  let entries: ArchiveEntry[];
  try {
    entries = await archiveEntries(name, bytes, limits);
  } catch (cause) {
    if (
      cause instanceof UnsupportedArchiveError ||
      cause instanceof UnsafeArchiveEntryError ||
      cause instanceof ArchiveLimitExceededError
    ) throw cause;
    throw new ArchiveDecodingFailedError(name, cause);
  }
  if (entries.length > limits.maxFiles) {
    throw new ArchiveLimitExceededError(
      "file count",
      entries.length,
      limits.maxFiles,
    );
  }

  let extractedBytes = 0;
  const normalized = entries.map((entry) => {
    const path = validateEntryPath(entry.path, limits);
    if (entry.bytes.length > limits.maxFileBytes) {
      throw new ArchiveLimitExceededError(
        "individual file byte",
        entry.bytes.length,
        limits.maxFileBytes,
      );
    }
    if (!entry.directory) extractedBytes += entry.bytes.length;
    if (extractedBytes > limits.maxExtractedBytes) {
      throw new ArchiveLimitExceededError(
        "extracted byte",
        extractedBytes,
        limits.maxExtractedBytes,
      );
    }
    return { ...entry, path };
  });

  const topLevels = [
    ...new Set(normalized.map(({ path }) => path.split("/")[0])),
  ];
  const topLevelFile = normalized.some(({ path, directory }) =>
    !directory && !path.includes("/")
  );
  if (topLevels.length !== 1 || topLevelFile || normalized.length === 0) {
    throw new InvalidArchiveTopologyError(topLevels);
  }

  let temporaryDirectory: string;
  try {
    temporaryDirectory = await (dependencies.makeTempDir ?? Deno.makeTempDir)({
      prefix: "colibri-build-verification-",
    });
  } catch (cause) {
    throw new SourceExtractionInitializationFailedError(cause);
  }
  const extractionRoot = resolve(temporaryDirectory);
  try {
    for (const entry of normalized) {
      const destination = resolve(join(extractionRoot, entry.path));
      if (entry.directory) {
        await Deno.mkdir(destination, { recursive: true });
      } else {
        await Deno.mkdir(dirname(destination), { recursive: true });
        await Deno.writeFile(destination, entry.bytes, { mode: 0o644 });
      }
    }
    return { root: join(temporaryDirectory, topLevels[0]), temporaryDirectory };
  } catch (cause) {
    try {
      await (dependencies.remove ?? Deno.remove)(temporaryDirectory, {
        recursive: true,
      });
    } catch (cleanupCause) {
      throw new SourceExtractionCleanupFailedError(cause, cleanupCause);
    }
    throw new SourceExtractionFailedError(cause);
  }
};

const readResponseBytes = async (
  response: Response,
  maximum: number,
): Promise<Uint8Array> => {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) {
    throw new ArchiveLimitExceededError("archive byte", declared, maximum);
  }
  if (!response.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maximum) {
      throw new ArchiveLimitExceededError("archive byte", total, maximum);
    }
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

const discardResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // The HTTP status remains the authoritative source-download failure.
  }
};

const download = async (
  url: string,
  fetcher: typeof fetch,
  limits: BuildVerificationLimits,
): Promise<Uint8Array> => {
  let response: Response;
  try {
    response = await fetcher(url, { redirect: "follow" });
  } catch (cause) {
    throw new SourceDownloadFailedError(url, cause);
  }
  if (!response.ok) {
    await discardResponseBody(response);
    throw new SourceDownloadFailedError(url, undefined, response.status);
  }
  try {
    return await readResponseBytes(response, limits.maxArchiveBytes);
  } catch (cause) {
    if (cause instanceof ArchiveLimitExceededError) throw cause;
    throw new SourceDownloadFailedError(url, cause, response.status);
  }
};

const githubArchiveUrl = (
  source: Extract<VerificationSource, { type: "github" }>,
): string => {
  for (const [field, value] of Object.entries(source)) {
    if (
      field !== "type" &&
      (!value || value.includes("/") || value.includes(".."))
    ) {
      throw new UnsupportedSourceError(
        "GitHub owner, repository, and ref values must be non-empty single path components.",
        { field, value },
      );
    }
  }
  return `https://github.com/${source.owner}/${source.repository}/archive/${source.ref}.tar.gz`;
};

/** Resolves, authenticates, and safely prepares a source tree for a build. */
export const prepareSource = async (args: {
  source?: VerificationSource;
  metadataUrl?: string;
  expectedSha256?: string;
  strict: boolean;
  fetcher: typeof fetch;
  limits: BuildVerificationLimits;
  dependencies?: SourcePreparationDependencies;
}): Promise<PreparedSource> => {
  const fromMetadataUrl = !args.source && !!args.metadataUrl;
  const source = args.source ??
    (args.metadataUrl
      ? { type: "url" as const, url: args.metadataUrl }
      : undefined);
  if (!source) throw new MissingVerificationSourceError();

  if (source.type === "path") {
    let stat: Deno.FileInfo;
    try {
      stat = await Deno.stat(source.path);
    } catch (cause) {
      throw new UnsupportedSourceError(
        "The local source path does not exist or cannot be read.",
        { path: source.path, cause: String(cause) },
      );
    }
    if (stat.isDirectory) {
      if (args.strict) {
        throw new UnsupportedSourceError(
          "Strict SEP-58 verification requires the exact source archive bytes so source_sha256 can be checked.",
          { path: source.path },
        );
      }
      return {
        directory: resolve(source.path),
        kind: "path",
        locator: resolve(source.path),
        cleanup: () => Promise.resolve(),
      };
    }
    let bytes: Uint8Array;
    try {
      bytes = await (args.dependencies?.readFile ?? Deno.readFile)(source.path);
    } catch (cause) {
      throw new LocalSourceArchiveReadFailedError(source.path, cause);
    }
    return await prepareArchive(
      source.path,
      bytes,
      "path",
      resolve(source.path),
      args,
    );
  }

  if (source.type === "archive") {
    return await prepareArchive(
      source.name,
      source.bytes,
      "archive",
      source.name,
      args,
    );
  }

  const url = source.type === "github" ? githubArchiveUrl(source) : source.url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (cause) {
    throw new UnsupportedSourceError(
      "Source URLs must be valid absolute URLs.",
      { url, cause: String(cause) },
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new UnsupportedSourceError(
      "This package currently resolves source archives over HTTP or HTTPS only.",
      { url, protocol: parsed.protocol },
    );
  }
  const bytes = await download(url, args.fetcher, args.limits);
  return await prepareArchive(
    parsed.pathname,
    bytes,
    fromMetadataUrl ? "metadataUrl" : source.type,
    url,
    args,
  );
};

const prepareArchive = async (
  name: string,
  bytes: Uint8Array,
  kind: PreparedSource["kind"],
  locator: string,
  args: {
    expectedSha256?: string;
    limits: BuildVerificationLimits;
    dependencies?: SourcePreparationDependencies;
  },
): Promise<PreparedSource> => {
  const digest = await sha256Hex(bytes);
  if (args.expectedSha256 && digest !== args.expectedSha256) {
    throw new SourceHashMismatchError(args.expectedSha256, digest);
  }
  const extracted = await extractArchive(
    name,
    bytes,
    args.limits,
    args.dependencies,
  );
  return {
    directory: extracted.root,
    kind,
    locator,
    sha256: digest,
    cleanup: async () => {
      try {
        await (args.dependencies?.remove ?? Deno.remove)(
          extracted.temporaryDirectory,
          { recursive: true },
        );
      } catch (cause) {
        throw new SourceCleanupFailedError(extracted.temporaryDirectory, cause);
      }
    },
  };
};
