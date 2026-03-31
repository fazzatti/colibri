/**
 * Numeric log levels used by the built-in quickstart console logger.
 */
export const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
} as const;

/**
 * Lowercase log level names accepted by quickstart logging helpers.
 */
export type LogLevelName =
  "trace" | "debug" | "info" | "warn" | "error" | "silent";

/**
 * Numeric log level values used by quickstart logging helpers.
 */
export type LogLevelNumber = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Accepted log level formats for quickstart logging.
 */
export type LogLevelDesc =
  | LogLevelNumber
  | LogLevelName
  | keyof typeof LogLevel;

/**
 * Minimal logger contract accepted by `StellarTestLedger`.
 */
export type LoggerLike = {
  /** Logs an error-level message. */
  error(...msg: unknown[]): void;
  /** Logs a warning-level message. */
  warn(...msg: unknown[]): void;
  /** Logs an info-level message. */
  info(...msg: unknown[]): void;
  /** Logs a debug-level message. */
  debug(...msg: unknown[]): void;
  /** Logs a trace-level message. */
  trace(...msg: unknown[]): void;
};

type LoggerOptions = {
  label: string;
  level?: LogLevelDesc;
  logger?: LoggerLike;
};

const LOG_LEVEL_NUMBER_TO_NAME: Record<LogLevelNumber, LogLevelName> = {
  [LogLevel.TRACE]: "trace",
  [LogLevel.DEBUG]: "debug",
  [LogLevel.INFO]: "info",
  [LogLevel.WARN]: "warn",
  [LogLevel.ERROR]: "error",
  [LogLevel.SILENT]: "silent",
};

const LOG_LEVEL_WEIGHT: Record<LogLevelName, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

/**
 * Normalizes numeric and string log levels into the internal string form.
 */
const normalizeLogLevel = (level: LogLevelDesc = "warn"): LogLevelName => {
  if (typeof level === "number") {
    return LOG_LEVEL_NUMBER_TO_NAME[level] ?? "warn";
  }

  const normalized = level.toLowerCase();
  switch (normalized) {
    case "trace":
    case "debug":
    case "info":
    case "warn":
    case "error":
    case "silent":
      return normalized as LogLevelName;
    default:
      return "warn";
  }
};

/**
 * Built-in console-backed logger used when no custom logger is provided.
 */
class ConsoleLogger implements LoggerLike {
  private readonly level: LogLevelName;

  constructor(
    private readonly label: string,
    level: LogLevelDesc = "warn",
  ) {
    this.level = normalizeLogLevel(level);
  }

  /**
   * Returns `true` when the requested log level should be emitted.
   */
  private shouldLog(level: LogLevelName): boolean {
    return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[this.level];
  }

  /**
   * Formats a standard prefix for console output.
   */
  private prefix(level: Uppercase<LogLevelName>): string {
    return `[${new Date().toISOString()}] ${level} (${this.label}):`;
  }

  public error(...msg: unknown[]): void {
    if (this.shouldLog("error")) console.error(this.prefix("ERROR"), ...msg);
  }

  public warn(...msg: unknown[]): void {
    if (this.shouldLog("warn")) console.warn(this.prefix("WARN"), ...msg);
  }

  public info(...msg: unknown[]): void {
    if (this.shouldLog("info")) console.info(this.prefix("INFO"), ...msg);
  }

  public debug(...msg: unknown[]): void {
    if (this.shouldLog("debug")) console.debug(this.prefix("DEBUG"), ...msg);
  }

  public trace(...msg: unknown[]): void {
    if (this.shouldLog("trace")) console.debug(this.prefix("TRACE"), ...msg);
  }
}

/**
 * Creates the logger used by quickstart internals.
 *
 * If `logger` is provided it is returned unchanged. Otherwise a simple
 * console-backed implementation is created.
 *
 * @param options - Logger configuration.
 *   - `label`: Prefix label attached to built-in console output.
 *   - `level`: Minimum built-in log level.
 *   - `logger`: Optional externally-managed logger implementation.
 * @returns A logger compatible with quickstart internals.
 *
 * @example
 * ```ts
 * const logger = createLogger({
 *   label: "StellarTestLedger",
 *   level: "debug",
 * });
 *
 * logger.info("ready");
 * ```
 */
export const createLogger = ({
  label,
  level,
  logger,
}: LoggerOptions): LoggerLike => {
  if (logger) {
    return logger;
  }

  return new ConsoleLogger(label, level);
};
