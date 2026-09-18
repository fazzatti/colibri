/** Keep Error and non-Error failures readable without changing their identity. */
export function diagnosticMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
