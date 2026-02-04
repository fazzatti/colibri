/**
 * Safely attempts to convert a value to XDR, returning an error message on failure.
 *
 * Useful for including XDR data in error messages without risking another error.
 *
 * @param fnToXDR - A function that converts a value to XDR base64 string
 * @returns The XDR string on success, or "Failed to convert to XDR" on failure
 */
export const softTryToXDR = (fnToXDR: () => string): string => {
  try {
    return fnToXDR();
  } catch {
    return "Failed to convert to XDR";
  }
};
