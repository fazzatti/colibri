/** Raw byte-comparison result used to finalize verification evidence. */
export type WasmComparison = {
  readonly equal: boolean;
  readonly targetLength: number;
  readonly rebuiltLength: number;
};
