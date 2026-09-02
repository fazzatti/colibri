// deno-coverage-ignore-file

import { readFile } from "node:fs/promises";

export const loadWasmFile = async (
  wasmFilePath: string,
): Promise<Uint8Array> => {
  try {
    const buffer = await readFile(wasmFilePath);
    return buffer;
  } catch (error) {
    console.error(`Error reading the WASM file: ${error}`);
    throw error;
  }
};
