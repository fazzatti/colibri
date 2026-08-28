import type { Buffer } from "node:buffer";
import { BuildLogCollectionFailedError } from "./error.ts";

const boundedText = (bytes: Uint8Array, maximum: number): string => {
  const truncated = bytes.length > maximum;
  const selected = truncated ? bytes.subarray(0, maximum) : bytes;
  return new TextDecoder().decode(selected) +
    (truncated ? "\n[logs truncated by Colibri]" : "");
};

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
