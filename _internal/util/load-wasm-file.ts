import { Buffer } from "buffer";
import { readFile } from "node:fs/promises";

export const loadWasmFile = async (wasmFilePath: string): Promise<Buffer> => {
  try {
    const buffer = await readFile(wasmFilePath);
    return buffer;
  } catch (error) {
    console.error(`Error reading the WASM file: ${error}`);
    throw error;
  }
};
