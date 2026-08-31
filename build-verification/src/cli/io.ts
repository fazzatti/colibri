/** Injectable terminal and filesystem boundary used by the CLI. */
export type BuildVerificationCliIo = {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly readTextFile: (path: string) => Promise<string>;
};

/** Default Deno-backed I/O used by the executable CLI. */
export const DEFAULT_BUILD_VERIFICATION_CLI_IO: BuildVerificationCliIo = {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  readFile: Deno.readFile,
  readTextFile: Deno.readTextFile,
};
