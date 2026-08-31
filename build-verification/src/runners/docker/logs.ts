import type { Buffer } from "node:buffer";
import { BuildLogCollectionFailedError } from "@/runners/docker/error.ts";

const boundedText = (bytes: Uint8Array, maximum: number): string => {
  const truncated = bytes.length > maximum;
  const selected = truncated ? bytes.subarray(0, maximum) : bytes;
  return new TextDecoder().decode(selected) +
    (truncated ? "\n[logs truncated by Colibri]" : "");
};

type BoundedDockerLog = {
  readonly chunks: Uint8Array[];
  bytes: number;
  truncated: boolean;
};

const appendBoundedDockerLog = (
  log: BoundedDockerLog,
  bytes: Uint8Array,
  maximum: number,
): void => {
  const remaining = Math.max(0, maximum - log.bytes);
  const selected = bytes.subarray(0, remaining);
  if (selected.length > 0) {
    log.chunks.push(Uint8Array.from(selected));
    log.bytes += selected.length;
  }
  if (selected.length < bytes.length) log.truncated = true;
};

const finalizeBoundedDockerLog = (log: BoundedDockerLog): string => {
  const bytes = new Uint8Array(log.bytes);
  let offset = 0;
  for (const chunk of log.chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes) +
    (log.truncated ? "\n[logs truncated by Colibri]" : "");
};

/** Drains Docker's multiplexed output while retaining bounded stream bytes. */
export const collectBoundedDockerLogStream = (
  stream: NodeJS.ReadableStream,
  maximum: number,
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const stdout: BoundedDockerLog = {
      chunks: [],
      bytes: 0,
      truncated: false,
    };
    const stderr: BoundedDockerLog = {
      chunks: [],
      bytes: 0,
      truncated: false,
    };
    const header = new Uint8Array(8);
    let headerOffset = 0;
    let payloadRemaining = 0;
    let payloadStream: 1 | 2 = 1;
    let settled = false;
    let ended = false;

    const cleanup = (): void => {
      stream.removeListener("data", onData);
      stream.removeListener("end", onEnd);
      stream.removeListener("error", onError);
      stream.removeListener("close", onClose);
    };
    const fail = (cause: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        cause instanceof BuildLogCollectionFailedError
          ? cause
          : new BuildLogCollectionFailedError(cause),
      );
    };
    const complete = (): void => {
      if (settled) return;
      if (headerOffset !== 0 || payloadRemaining !== 0) {
        fail(new RangeError("Docker log stream ended inside a frame"));
        return;
      }
      settled = true;
      cleanup();
      resolve({
        stdout: finalizeBoundedDockerLog(stdout),
        stderr: finalizeBoundedDockerLog(stderr),
      });
    };
    const onData = (value: unknown): void => {
      try {
        const chunk = typeof value === "string"
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : (() => {
            throw new TypeError("Docker log stream emitted non-byte data");
          })();
        let offset = 0;
        while (offset < chunk.length) {
          if (payloadRemaining === 0) {
            const headerBytes = Math.min(
              8 - headerOffset,
              chunk.length - offset,
            );
            header.set(
              chunk.subarray(offset, offset + headerBytes),
              headerOffset,
            );
            headerOffset += headerBytes;
            offset += headerBytes;
            if (headerOffset < 8) continue;
            if (
              (header[0] !== 1 && header[0] !== 2) || header[1] !== 0 ||
              header[2] !== 0 || header[3] !== 0
            ) {
              throw new RangeError("Malformed Docker multiplexed log header");
            }
            payloadStream = header[0];
            payloadRemaining = new DataView(header.buffer).getUint32(4);
            headerOffset = 0;
            if (payloadRemaining === 0) continue;
          }
          const payloadBytes = Math.min(
            payloadRemaining,
            chunk.length - offset,
          );
          appendBoundedDockerLog(
            payloadStream === 1 ? stdout : stderr,
            chunk.subarray(offset, offset + payloadBytes),
            maximum,
          );
          payloadRemaining -= payloadBytes;
          offset += payloadBytes;
        }
      } catch (cause) {
        fail(cause);
      }
    };
    const onEnd = (): void => {
      ended = true;
      complete();
    };
    const onError = (cause: unknown): void => fail(cause);
    const onClose = (): void => {
      if (!ended) fail(new Error("Docker log stream closed before ending"));
    };

    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
    stream.on("close", onClose);
    stream.resume();
  });

/** Decodes and bounds Docker's raw or multiplexed log representation. */
export const demultiplexDockerLogs = (
  value: Buffer | string,
  maximum: number,
): { stdout: string; stderr: string } => {
  try {
    const bytes = typeof value === "string"
      ? new TextEncoder().encode(value)
      : new Uint8Array(value);
    const stdout: number[] = [];
    const stderr: number[] = [];
    let offset = 0;
    let multiplexed = bytes.length >= 8 && (bytes[0] === 1 || bytes[0] === 2) &&
      bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0;
    if (!multiplexed) {
      return { stdout: boundedText(bytes, maximum), stderr: "" };
    }
    while (offset + 8 <= bytes.length) {
      const stream = bytes[offset];
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4)
        .getUint32(0);
      const end = offset + 8 + size;
      if ((stream !== 1 && stream !== 2) || end > bytes.length) {
        multiplexed = false;
        break;
      }
      const destination = stream === 2 ? stderr : stdout;
      destination.push(...bytes.subarray(offset + 8, end));
      offset = end;
    }
    if (!multiplexed || offset !== bytes.length) {
      throw new RangeError("Malformed Docker multiplexed log stream");
    }
    return {
      stdout: boundedText(new Uint8Array(stdout), maximum),
      stderr: boundedText(new Uint8Array(stderr), maximum),
    };
  } catch (cause) {
    throw new BuildLogCollectionFailedError(cause);
  }
};
