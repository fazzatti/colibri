import type {
  BuildVerificationStage,
  VerificationLogEvent,
} from "@/core/index.ts";

const CLEAR_TERMINAL_LINE = "\r\x1b[2K";
const SPINNER_INTERVAL_MS = 80;
const SPINNER_FRAMES = Object.freeze([
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
]);

const STAGE_STATUS: Readonly<Record<BuildVerificationStage, string>> = {
  "resolve-verification-target": "Resolving verification target…",
  "parse-contract-metadata": "Parsing contract metadata…",
  "validate-build-recipe": "Validating build recipe…",
  "resolve-source-archive": "Resolving source archive…",
  "resolve-build-image": "Resolving build image…",
  "execute-contract-build": "Rebuilding contract…",
  "select-build-artifact": "Selecting build artifact…",
  "compare-contract-wasm": "Comparing contract Wasm…",
};

type BuildVerificationSpinnerOptions = {
  readonly write: (text: string) => void;
  readonly setInterval?: (callback: () => void, milliseconds: number) => number;
  readonly clearInterval?: (id: number) => void;
};

/** Internal animated status controller for an interactive CLI invocation. */
export type BuildVerificationSpinner = {
  readonly update: (status: string) => void;
  readonly stop: () => void;
};

/** Formats one stable spinner status from a structured verification event. */
export const formatBuildVerificationSpinnerStatus = (
  event: VerificationLogEvent,
): string => `Verifying contract build · ${STAGE_STATUS[event.stage]}`;

/** Starts a single-line spinner and returns its update and cleanup controls. */
export const createBuildVerificationSpinner = (
  options: BuildVerificationSpinnerOptions,
): BuildVerificationSpinner => {
  const schedule = options.setInterval ?? globalThis.setInterval;
  const cancel = options.clearInterval ?? globalThis.clearInterval;
  let frame = 0;
  let status = "Verifying contract build…";
  let stopped = false;

  const render = (): void => {
    options.write(
      `${CLEAR_TERMINAL_LINE}${SPINNER_FRAMES[frame]} ${status}`,
    );
    frame = (frame + 1) % SPINNER_FRAMES.length;
  };

  render();
  const timer = schedule(render, SPINNER_INTERVAL_MS);

  return {
    update: (nextStatus) => {
      if (stopped) return;
      status = nextStatus;
      render();
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancel(timer);
      options.write(CLEAR_TERMINAL_LINE);
    },
  };
};
