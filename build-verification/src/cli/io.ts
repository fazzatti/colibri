/** Injectable terminal and filesystem boundary used by the CLI. */
export type BuildVerificationCliIo = {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  /** Optional raw standard-error writer used for interactive animation. */
  readonly stderrWrite?: (text: string) => void;
  readonly readFile: (path: string) => Promise<Uint8Array>;
  readonly readTextFile: (path: string) => Promise<string>;
  /** Optional injectable environment reader used only for selected secrets. */
  readonly getEnv?: (name: string) => string | undefined;
  /** Optional terminal probe used to avoid progress output in pipelines. */
  readonly stderrIsTerminal?: () => boolean;
};

const STDERR_ENCODER = new TextEncoder();

/** Default Deno-backed I/O used by the executable CLI. */
export const DEFAULT_BUILD_VERIFICATION_CLI_IO: BuildVerificationCliIo = {
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  stderrWrite: (text) => {
    Deno.stderr.writeSync(STDERR_ENCODER.encode(text));
  },
  readFile: Deno.readFile,
  readTextFile: Deno.readTextFile,
  getEnv: Deno.env.get,
  stderrIsTerminal: () => Deno.stderr.isTerminal(),
};
