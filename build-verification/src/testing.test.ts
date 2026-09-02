import { xdr } from "stellar-sdk";
import {
  createVerificationEvidence,
  DEFAULT_BUILD_VERIFICATION_LIMITS,
} from "@/core/index.ts";
import type {
  BuildVerificationLimits,
  ContainerImageDetails,
  ContractBuildRecipe,
  ContractMetadataEntry,
  PolicyDecision,
} from "@/core/index.ts";

/** Deterministic timestamp shared by package tests. */
export const TEST_NOW = "2026-08-28T12:00:00.000Z";
/** Deterministic OCI digest shared by package tests. */
export const TEST_DIGEST = `sha256:${"a".repeat(64)}`;
/** Deterministic official image reference shared by package tests. */
export const TEST_IMAGE = `docker.io/stellar/stellar-cli@${TEST_DIGEST}`;
/** Resource limits suitable for deterministic unit tests. */
export const TEST_LIMITS: BuildVerificationLimits = {
  ...DEFAULT_BUILD_VERIFICATION_LIMITS,
  maxArchiveBytes: 1024 * 1024,
  maxExtractedBytes: 1024 * 1024,
  maxFileBytes: 512 * 1024,
  maxArtifactBytes: 512 * 1024,
  maxFiles: 100,
  maxPathLength: 256,
  maxLogBytes: 4096,
  maxLogEvents: 32,
  timeoutMs: 1000,
  downloadTimeoutMs: 1000,
};

/** Joins binary fragments without relying on Node Buffer semantics. */
export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
};

/** Encodes one unsigned LEB128 integer used by Wasm sections. */
export const unsignedLeb128 = (value: number): number[] => {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return bytes;
};

/** Encodes one Stellar contract metadata custom section. */
export const contractMetadataSection = (
  entries: readonly ContractMetadataEntry[],
): Uint8Array => {
  const name = new TextEncoder().encode("contractmetav0");
  const body = concatBytes(
    new Uint8Array([...unsignedLeb128(name.length), ...name]),
    ...entries.map(({ key, value }) =>
      new Uint8Array(
        xdr.ScMetaEntry.scMetaV0(new xdr.ScMetaV0({ key, val: value })).toXdr(),
      )
    ),
  );
  return new Uint8Array([0, ...unsignedLeb128(body.length), ...body]);
};

/** Builds a minimal valid Wasm with optional custom sections. */
export const testWasm = (...sections: Uint8Array[]): Uint8Array =>
  concatBytes(
    new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
    ...sections,
  );

/** Builds a minimal valid Wasm with one contract metadata section. */
export const testWasmWithMetadata = (
  entries: readonly ContractMetadataEntry[],
): Uint8Array => testWasm(contractMetadataSection(entries));

/** Accepted structured policy decision used by injected boundaries. */
export const acceptedPolicyDecision = (
  policy = "test.policy",
): PolicyDecision => ({
  accepted: true,
  policy,
  version: "1",
  checks: [{ name: "fixture", passed: true }],
  reasons: [],
  warnings: [],
});

/** Rejected structured policy decision used by injected boundaries. */
export const rejectedPolicyDecision = (
  policy = "test.policy",
): PolicyDecision => ({
  accepted: false,
  policy,
  version: "1",
  checks: [{ name: "fixture", passed: false }],
  reasons: ["fixture rejection"],
  warnings: [],
});

/** Fully resolved image fixture satisfying the execution contract. */
export const testImageDetails = (
  overrides: Partial<ContainerImageDetails> = {},
): ContainerImageDetails => ({
  reference: TEST_IMAGE,
  registry: "docker.io",
  repository: "stellar/stellar-cli",
  requestedDigest: TEST_DIGEST,
  manifestDigest: TEST_DIGEST,
  manifestMediaType: "application/vnd.oci.image.manifest.v1+json",
  resolvedThroughIndex: false,
  architecture: "amd64",
  os: "linux",
  configDigest: `sha256:${"b".repeat(64)}`,
  entrypoint: ["stellar"],
  workingDirectory: "/source",
  environment: ["RUSTUP_TOOLCHAIN=1.88.0", "SECRET=redacted"],
  user: "1000",
  rustupToolchain: "1.88.0",
  referrers: [],
  provenance: {
    present: false,
    parsed: false,
    signatureVerified: false,
    predicateTypes: [],
    subjectDigests: [],
    sourceRepositories: [],
  },
  sbom: { present: false, formats: [] },
  ...overrides,
});

/** Caller-supplied recipe fixture accepted by default command policies. */
export const testRecipe = (
  overrides: Partial<ContractBuildRecipe> = {},
): ContractBuildRecipe => ({
  image: TEST_IMAGE,
  arguments: ["contract", "build"],
  options: [],
  metadata: [],
  ...overrides,
});

/** Initial evidence fixture for directly testing later process stages. */
export const testEvidence = () =>
  createVerificationEvidence("outOfBand", TEST_NOW);

const writeAscii = (
  target: Uint8Array,
  offset: number,
  length: number,
  value: string,
): void =>
  target.set(new TextEncoder().encode(value).subarray(0, length), offset);

/** Builds a deterministic tar fixture with regular, directory, or special entries. */
export const testTar = (
  entries: readonly {
    readonly path: string;
    readonly value?: string;
    readonly type?: string;
  }[],
): Uint8Array => {
  const chunks: Uint8Array[] = [];
  for (const entry of entries) {
    const bytes = new TextEncoder().encode(entry.value ?? "");
    const header = new Uint8Array(512);
    writeAscii(header, 0, 100, entry.path);
    writeAscii(header, 100, 8, "0000644\0");
    writeAscii(
      header,
      124,
      12,
      `${bytes.length.toString(8).padStart(11, "0")}\0`,
    );
    header[156] = (entry.type ?? "0").charCodeAt(0);
    chunks.push(
      header,
      bytes,
      new Uint8Array((512 - bytes.length % 512) % 512),
    );
  }
  return concatBytes(...chunks, new Uint8Array(1024));
};

/** Gzip-compresses bytes for tar.gz extraction fixtures. */
export const gzipTestBytes = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(
    await new Response(
      new Blob([Uint8Array.from(bytes)]).stream().pipeThrough(
        new CompressionStream("gzip"),
      ),
    ).arrayBuffer(),
  );

const ZIP_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const zipCrc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = ZIP_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const u16le = (value: number): Uint8Array =>
  new Uint8Array([value & 0xff, value >>> 8 & 0xff]);
const u32le = (value: number): Uint8Array =>
  new Uint8Array([
    value & 0xff,
    value >>> 8 & 0xff,
    value >>> 16 & 0xff,
    value >>> 24 & 0xff,
  ]);

const rawDeflateStoredBlock = (bytes: Uint8Array): Uint8Array =>
  concatBytes(
    new Uint8Array([1]),
    u16le(bytes.length),
    u16le((~bytes.length) & 0xffff),
    bytes,
  );

/** Builds a single-disk ZIP fixture using stored or raw-deflate entries. */
export const testZip = (
  entries: readonly {
    readonly path: string;
    readonly value?: string;
    readonly directory?: boolean;
    readonly deflate?: boolean;
    readonly flags?: number;
    readonly externalAttributes?: number;
    readonly crc?: number;
  }[],
): Uint8Array => {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.path);
    const bytes = new TextEncoder().encode(entry.value ?? "");
    const compressed = entry.deflate ? rawDeflateStoredBlock(bytes) : bytes;
    const method = entry.deflate ? 8 : 0;
    const flags = entry.flags ?? 0x800;
    const crc = entry.crc ?? zipCrc32(bytes);
    const localRecord = concatBytes(
      u32le(0x04034b50),
      u16le(20),
      u16le(flags),
      u16le(method),
      u16le(0),
      u16le(0),
      u32le(crc),
      u32le(compressed.length),
      u32le(bytes.length),
      u16le(name.length),
      u16le(0),
      name,
      compressed,
    );
    local.push(localRecord);
    central.push(concatBytes(
      u32le(0x02014b50),
      u16le(3 << 8 | 20),
      u16le(20),
      u16le(flags),
      u16le(method),
      u16le(0),
      u16le(0),
      u32le(crc),
      u32le(compressed.length),
      u32le(bytes.length),
      u16le(name.length),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(
        entry.externalAttributes ??
          (entry.directory ? 0o040755 << 16 : 0o100644 << 16),
      ),
      u32le(localOffset),
      name,
    ));
    localOffset += localRecord.length;
  }
  const localBytes = concatBytes(...local);
  const centralBytes = concatBytes(...central);
  return concatBytes(
    localBytes,
    centralBytes,
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(entries.length),
    u16le(entries.length),
    u32le(centralBytes.length),
    u32le(localBytes.length),
    u16le(0),
  );
};
